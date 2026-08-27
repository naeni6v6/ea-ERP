# MotionBridge ERP 원클릭 실행 스크립트 — 실행.bat 이 호출한다.
# DB 우선순위: 이미 실행 중(5432) → 포터블 PostgreSQL(%USERPROFILE%\pgportable) → Docker
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'MotionBridge ERP 실행'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Fail($msg) {
    Write-Host ""
    Write-Host "[오류] $msg" -ForegroundColor Red
    Read-Host "Enter 키를 누르면 창이 닫힙니다"
    exit 1
}
function Test-Port($port) {
    $c = New-Object Net.Sockets.TcpClient
    try { $c.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $c.Close() }
}
function Wait-Port($port, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        if (Test-Port $port) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

Write-Host "=============================================="
Write-Host "   MotionBridge ERP - 원클릭 실행"
Write-Host "=============================================="
Write-Host ""

# ── 1. Node.js 확인 ─────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
}

# ── 2. pnpm 확인 (없으면 corepack shim을 사용자 폴더에 생성) ─────
# 루트 스크립트가 내부에서 다시 pnpm을 호출하므로, PATH에 실제 pnpm 명령이 있어야 한다.
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    $shimDir = Join-Path $env:LOCALAPPDATA 'ea-erp-pnpm'
    if (-not (Test-Path (Join-Path $shimDir 'pnpm.CMD'))) {
        New-Item -ItemType Directory -Force $shimDir | Out-Null
        corepack enable --install-directory $shimDir pnpm
        if ($LASTEXITCODE -ne 0) { Fail "pnpm 설치(corepack)에 실패했습니다. 인터넷 연결을 확인하세요." }
    }
    $env:PATH = "$shimDir;$env:PATH"
}
function Invoke-Pnpm {
    param([Parameter(ValueFromRemainingArguments = $true)]$rest)
    & pnpm @rest | Out-Host
    return $LASTEXITCODE
}

# ── 3. .env 자동 생성 ───────────────────────────
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
if (-not (Test-Path 'packages\db\.env')) { Copy-Item '.env' 'packages\db\.env' }
if (-not (Test-Path 'apps\api\.env')) { Copy-Item '.env' 'apps\api\.env' }
if (-not (Test-Path 'apps\web\.env.local')) {
    Set-Content -Path 'apps\web\.env.local' -Value 'NEXT_PUBLIC_API_BASE=http://localhost:4000/api' -Encoding Ascii
}

# ── 4. PostgreSQL 준비 ──────────────────────────
$pgPortable = Join-Path $env:USERPROFILE 'pgportable'
if (Test-Port 5432) {
    Write-Host "[1/5] PostgreSQL 실행 확인 (port 5432)"
}
elseif (Test-Path (Join-Path $pgPortable 'pgsql\bin\pg_ctl.exe')) {
    Write-Host "[1/5] 포터블 PostgreSQL 시작 중..."
    $pgCtl = Join-Path $pgPortable 'pgsql\bin\pg_ctl.exe'
    $pgData = Join-Path $pgPortable 'data'
    $pgLog = Join-Path $pgPortable 'pg.log'
    & $pgCtl -D $pgData -l $pgLog -w start
    if (-not (Wait-Port 5432 30)) { Fail "포터블 PostgreSQL 시작 실패. $pgLog 를 확인하세요." }
}
else {
    # Docker 경로: CLI를 PATH에서 못 찾으면 알려진 설치 위치를 추가
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $dockerBins = @(
            'C:\Program Files\Docker\Docker\resources\bin',
            (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin')
        )
        foreach ($d in $dockerBins) {
            if (Test-Path (Join-Path $d 'docker.exe')) { $env:PATH = "$d;$env:PATH"; break }
        }
    }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "[오류] PostgreSQL 데이터베이스를 찾을 수 없습니다." -ForegroundColor Red
        Write-Host ""
        Write-Host "  다음 중 하나를 준비하세요."
        Write-Host "  1. 포터블 PostgreSQL 을 $pgPortable 에 설치 (권장)"
        Write-Host "  2. Docker Desktop 설치 + WSL2 (Windows 10 Home 은 WSL2 필수)"
        Write-Host "  3. PostgreSQL 16 직접 설치 후 .env 의 DATABASE_URL 수정"
        Write-Host ""
        Read-Host "Enter 키를 누르면 창이 닫힙니다"
        exit 1
    }
    # Docker Desktop 이 꺼져 있으면 실행
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        $desktopExes = @(
            'C:\Program Files\Docker\Docker\Docker Desktop.exe',
            (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\frontend\Docker Desktop.exe')
        )
        foreach ($e in $desktopExes) {
            if (Test-Path $e) { Start-Process $e; break }
        }
    }
    # 엔진이 완전히 준비될 때까지 대기 — 준비 전에 compose 를 치면 500 오류가 난다
    Write-Host "[1/5] Docker 엔진 준비 대기 중... 최대 3분"
    $engineReady = $false
    for ($i = 0; $i -lt 36; $i++) {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $engineReady = $true; break }
        Start-Sleep -Seconds 5
    }
    if (-not $engineReady) {
        Write-Host ""
        Write-Host "[오류] Docker 엔진이 시작되지 않습니다." -ForegroundColor Red
        Write-Host "  이 PC(Windows 10 Home)는 WSL2가 설치되어 있어야 Docker가 동작합니다."
        Write-Host "  관리자 PowerShell에서 'wsl --install' 실행 후 재부팅하거나,"
        Write-Host "  포터블 PostgreSQL($pgPortable)을 사용하세요."
        Write-Host ""
        Read-Host "Enter 키를 누르면 창이 닫힙니다"
        exit 1
    }
    Write-Host "      PostgreSQL 컨테이너 시작 중..."
    docker compose up -d db
    if ($LASTEXITCODE -ne 0) { Fail "docker compose 실행 실패. 위 로그를 확인하세요." }
    if (-not (Wait-Port 5432 60)) { Fail "DB가 60초 안에 준비되지 않았습니다." }
}

# ── 5. 의존성 설치 (최초 1회) ───────────────────
$freshInstall = $false
if (-not (Test-Path 'node_modules\.pnpm')) {
    Write-Host "[2/5] 의존성 설치 중... 최초 1회는 몇 분 걸릴 수 있습니다."
    if ((Invoke-Pnpm install) -ne 0) { Fail "의존성 설치에 실패했습니다. 인터넷 연결을 확인하세요." }
    $freshInstall = $true
} else {
    Write-Host "[2/5] 의존성 설치 확인 완료"
}
if ($freshInstall) { Invoke-Pnpm db:generate | Out-Null }

# ── 6. 마이그레이션 + 최초 시드 ─────────────────
Write-Host "[3/5] DB 마이그레이션 확인 중..."
if ((Invoke-Pnpm --filter '@ea-erp/db' run deploy) -ne 0) { Fail "DB 마이그레이션 실패. 위 로그를 확인하세요." }
if (-not (Test-Path '.seed-done')) {
    Write-Host "      초기 데이터 등록 중... (사업유형 / 부서 / 계정과목 / CEO 계정)"
    if ((Invoke-Pnpm db:seed) -eq 0) { Set-Content -Path '.seed-done' -Value 'done' }
}

# ── 7. 자동 백업 — DB 덤프(최근 14개 보관) + 소스 스냅샷 커밋 ──
Write-Host "[4/5] 자동 백업 중..."
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$pgDump = Join-Path $pgPortable 'pgsql\bin\pg_dump.exe'
if (Test-Path $pgDump) {
    New-Item -ItemType Directory -Force 'backups' | Out-Null
    $env:PGPASSWORD = 'erp'
    & $pgDump -h localhost -U erp -Fc -f "backups\ea_erp_$stamp.dump" ea_erp 2>$null
    if (Test-Path "backups\ea_erp_$stamp.dump") {
        Get-ChildItem 'backups\ea_erp_*.dump' | Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 14 | Remove-Item -Force -ErrorAction SilentlyContinue
        Write-Host "      DB 백업 완료: backups\ea_erp_$stamp.dump"
    }
}
if ((Test-Path '.git') -and (Get-Command git -ErrorAction SilentlyContinue)) {
    git add -A 2>$null | Out-Null
    git commit -m "자동 백업 $stamp" 2>$null | Out-Null
}

# ── 8. 빌드 확인 — 소스가 바뀐 경우에만 다시 빌드 (평소엔 건너뛰어 수 초 만에 시작) ──
function Get-NewestWrite($paths) {
    $files = Get-ChildItem $paths -Recurse -File -ErrorAction SilentlyContinue
    if (-not $files) { return Get-Date 0 }
    return ($files | Measure-Object -Maximum LastWriteTime).Maximum
}
$apiOut = 'apps\api\dist\main.js'
if ((-not (Test-Port 4000)) -and ((-not (Test-Path $apiOut)) -or ((Get-NewestWrite @('apps\api\src', 'packages\db\prisma\schema.prisma')) -gt (Get-Item $apiOut).LastWriteTime))) {
    Write-Host "      API 빌드 중... (코드가 바뀐 경우에만 수행)"
    if ((Invoke-Pnpm --filter '@ea-erp/api' build) -ne 0) { Fail "API 빌드 실패. 위 로그를 확인하세요." }
}
$webOut = 'apps\web\.next\BUILD_ID'
if ((-not (Test-Port 3000)) -and ((-not (Test-Path $webOut)) -or ((Get-NewestWrite @('apps\web\src', 'apps\web\tailwind.config.ts')) -gt (Get-Item $webOut).LastWriteTime))) {
    Write-Host "      웹 빌드 중... (코드가 바뀐 경우에만, 1~2분)"
    if ((Invoke-Pnpm --filter '@ea-erp/web' build) -ne 0) { Fail "웹 빌드 실패. 위 로그를 확인하세요." }
}

# ── 9. API + Web 서버 시작 (프로덕션 모드 — 빠르고 가볍다. 이미 켜져 있으면 건너뜀) ──
if (Test-Port 4000) {
    Write-Host "      API 서버(4000)가 이미 실행 중입니다."
} else {
    Write-Host "      API 서버 시작 중... (별도 창, 닫으면 종료)"
    Start-Process cmd -ArgumentList '/k', "cd /d `"$root`" & pnpm --filter @ea-erp/api start"
}
if (Test-Port 3000) {
    Write-Host "      웹 서버(3000)가 이미 실행 중입니다."
} else {
    Write-Host "      웹 서버 시작 중... (별도 창, 닫으면 종료)"
    Start-Process cmd -ArgumentList '/k', "cd /d `"$root`" & pnpm --filter @ea-erp/web start"
}
$apiOk = Wait-Port 4000 60
$webOk = Wait-Port 3000 30
if (-not ($apiOk -and $webOk)) {
    Write-Host "[주의] 서버가 아직 준비되지 않았습니다. 서버 창의 로그를 확인한 뒤 브라우저에서 새로고침 하세요." -ForegroundColor Yellow
}

# ── 8. 웹 화면 열기 ─────────────────────────────
Write-Host "[5/5] 웹 화면을 브라우저로 엽니다. http://localhost:3000"
Start-Process 'http://localhost:3000'
Write-Host ""
Write-Host "=============================================="
Write-Host " 완료! 초기 로그인 계정"
Write-Host "   이메일:   ceo@eacompany.kr"
Write-Host "   비밀번호: changeme123!"
Write-Host "=============================================="
Write-Host " 이 창은 10초 후 자동으로 닫힙니다."
Start-Sleep -Seconds 10
exit 0
