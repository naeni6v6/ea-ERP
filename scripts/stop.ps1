# MotionBridge ERP 종료 스크립트 — 종료.bat 이 호출한다.
$Host.UI.RawUI.WindowTitle = 'MotionBridge ERP 종료'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "웹/API 서버 종료 중..."
foreach ($port in 3000, 4000) {
    $conns = netstat -ano | Select-String ":$port\s" | Select-String 'LISTENING'
    foreach ($line in $conns) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            taskkill /PID $procId /T /F 2>$null | Out-Null
        }
    }
}

# 서버를 띄웠던 검은 창 정리 — 예전 /k 방식으로 열려 서버가 죽은 뒤에도 빈 채로
# 남아 있는 창들을 함께 닫는다. 명령줄이 정확히 서버 실행인 것만 고른다.
$ghosts = @(Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match '@ea-erp/(api|web)\s+start' })
foreach ($g in $ghosts) { taskkill /PID $g.ProcessId /T /F 2>$null | Out-Null }
if ($ghosts.Count -gt 0) { Write-Host "남아 있던 서버 창 $($ghosts.Count)개를 닫았습니다." }

# 모바일 앱 개발 서버(휴대폰 QR 8081 / PC 뷰어 8082)도 함께 정리
foreach ($port in 8081, 8082) {
    $conns = netstat -ano | Select-String ":$port\s" | Select-String 'LISTENING'
    foreach ($line in $conns) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            taskkill /PID $procId /T /F 2>$null | Out-Null
        }
    }
}
$expo = @(Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'expo\s+start' })
foreach ($e in $expo) { taskkill /PID $e.ProcessId /T /F 2>$null | Out-Null }

$pgPortable = Join-Path $env:USERPROFILE 'pgportable'
$pgCtl = Join-Path $pgPortable 'pgsql\bin\pg_ctl.exe'
if (Test-Path $pgCtl) {
    Write-Host "포터블 PostgreSQL 종료 중..."
    & $pgCtl -D (Join-Path $pgPortable 'data') -w stop
} else {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        foreach ($d in @('C:\Program Files\Docker\Docker\resources\bin', (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'))) {
            if (Test-Path (Join-Path $d 'docker.exe')) { $env:PATH = "$d;$env:PATH"; break }
        }
    }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PostgreSQL 컨테이너 종료 중..."
            docker compose -f 'scripts\docker-compose.yml' stop db 2>$null | Out-Null
        }
    }
}

Write-Host ""
Write-Host "모두 종료했습니다."
Start-Sleep -Seconds 4
exit 0
