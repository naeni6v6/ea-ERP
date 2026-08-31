# MotionBridge ERP 일일 자동 백업 — 작업 스케줄러가 하루 한 번 호출한다.
# 실행.bat 을 누를 때만 백업되던 것을 보완한다(PC를 계속 켜둬도 매일 남는다).
# 등록:   scripts\backup-register.ps1
# 로그:   backups\backup.log
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$backupDir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null
$log = Join-Path $backupDir 'backup.log'
function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path $log -Value $line -Encoding utf8
    Write-Host $line
}

function Test-Port($port) {
    $c = New-Object Net.Sockets.TcpClient
    try { $c.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $c.Close() }
}

$pgPortable = Join-Path $env:USERPROFILE 'pgportable'
$pgDump = Join-Path $pgPortable 'pgsql\bin\pg_dump.exe'
$pgCtl = Join-Path $pgPortable 'pgsql\bin\pg_ctl.exe'
$pgData = Join-Path $pgPortable 'data'

if (-not (Test-Path $pgDump)) {
    Log "[실패] pg_dump 를 찾을 수 없습니다: $pgDump"
    exit 1
}

# DB가 꺼져 있으면 잠깐 올렸다가 백업 후 원래대로 되돌린다
$startedByMe = $false
if (-not (Test-Port 5432)) {
    if (-not (Test-Path $pgCtl)) { Log '[실패] DB가 꺼져 있고 pg_ctl 도 없습니다'; exit 1 }
    Log 'DB가 꺼져 있어 임시로 시작합니다'
    & $pgCtl -D $pgData -l (Join-Path $pgPortable 'pg.log') -w start | Out-Null
    for ($i = 0; $i -lt 30; $i++) { if (Test-Port 5432) { break }; Start-Sleep -Seconds 1 }
    if (-not (Test-Port 5432)) { Log '[실패] DB 시작에 실패했습니다'; exit 1 }
    $startedByMe = $true
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out = Join-Path $backupDir "ea_erp_$stamp.dump"
$env:PGPASSWORD = 'erp'
& $pgDump -h localhost -U erp -Fc -f $out ea_erp 2>$null
$dumpOk = (Test-Path $out) -and ((Get-Item $out).Length -gt 0)

if ($dumpOk) {
    $kb = [Math]::Round((Get-Item $out).Length / 1KB)
    Log "백업 완료: ea_erp_$stamp.dump ($kb KB)"
    # 최근 14개만 보관
    $old = Get-ChildItem (Join-Path $backupDir 'ea_erp_*.dump') | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14
    if ($old) {
        $old | Remove-Item -Force -ErrorAction SilentlyContinue
        Log "오래된 백업 $($old.Count)개 정리"
    }
} else {
    Log '[실패] pg_dump 가 파일을 만들지 못했습니다'
    if (Test-Path $out) { Remove-Item $out -Force -ErrorAction SilentlyContinue }
}

# 소스 스냅샷 커밋 — 원격 저장소가 붙어 있으면 push 까지
if ((Test-Path (Join-Path $root '.git')) -and (Get-Command git -ErrorAction SilentlyContinue)) {
    git add -A 2>$null | Out-Null
    git commit -m "자동 백업 $stamp" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Log "소스 커밋: 자동 백업 $stamp" }
    if (git remote 2>$null) {
        git push 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { Log '원격 저장소 push 완료' } else { Log '[주의] 원격 push 실패' }
    }
}

if ($startedByMe) {
    Log 'DB를 원래 상태(중지)로 되돌립니다'
    & $pgCtl -D $pgData -w stop | Out-Null
}

if (-not $dumpOk) { exit 1 }
exit 0
