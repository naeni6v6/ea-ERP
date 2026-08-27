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
