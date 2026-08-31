# PC용 모바일 뷰어 실행 — 모바일뷰어_실행.bat 이 호출한다.
# 주의: 한글이 깨지지 않도록 반드시 UTF-8 BOM으로 저장한다 (run.ps1과 동일 규칙).
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = '모션브릿지 모바일 뷰어'
Set-Location $PSScriptRoot

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

Write-Host "=============================================="
Write-Host "   모션브릿지 모바일 뷰어 (PC에서 앱 화면 보기)"
Write-Host "=============================================="
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
}

# ── 1. 앱 부품 확인 ─────────────────────────────
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
    Write-Host "[1/3] 앱 부품 설치 중... (처음 한 번만, 1~2분)"
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "설치에 실패했습니다. 인터넷 연결을 확인하세요." }
} else {
    Write-Host "[1/3] 앱 부품 확인 완료"
}

# ── 2. ERP 서버 확인 ────────────────────────────
if (Test-Port 4000) {
    Write-Host "[2/3] ERP 서버 실행 중 — 정상"
} else {
    Write-Host "[2/3] ERP 서버가 꺼져 있습니다" -ForegroundColor Yellow
    Write-Host "      화면은 보이지만 로그인·조회가 되지 않습니다."
    Write-Host "      ea-erp 폴더의 실행.bat 을 먼저 실행해 주세요." -ForegroundColor Yellow
}

# ── 3. 뷰어 열기 ────────────────────────────────
# 휴대폰용(앱실행.bat)은 8081을 쓰므로 뷰어는 8082로 분리한다 — 둘을 동시에 켤 수 있다.
# 뷰어 페이지도 같은 서버가 서빙하므로 앱과 같은 주소 = 화면 제약이 없다.
$viewerPort = 8082
if (Test-Port $viewerPort) {
    Write-Host "      뷰어 서버가 이미 켜져 있습니다 — 창만 새로 엽니다." -ForegroundColor Yellow
    Start-Process "http://localhost:$viewerPort/viewer.html"
    Write-Host ""
    Read-Host "Enter 키를 누르면 이 창이 닫힙니다 (뷰어는 계속 켜져 있습니다)"
    exit 0
}
$viewerUrl = "http://localhost:$viewerPort/viewer.html"
Write-Host "[3/3] 뷰어 주소: $viewerUrl"
Write-Host ""
Write-Host "----------------------------------------------"
Write-Host "  잠시 뒤 브라우저가 저절로 열립니다."
Write-Host "  첫 실행은 앱을 만드는 데 30초~1분쯤 걸립니다."
Write-Host ""
Write-Host "  코드를 고치면 뷰어 화면이 저절로 갱신됩니다."
Write-Host "  이 창을 닫으면 뷰어도 멈춥니다. 끝낼 때는 Ctrl+C"
Write-Host "----------------------------------------------"
Write-Host ""

# 서버가 뜨면 브라우저를 여는 작업을 따로 돌린다 (expo는 이 창을 계속 점유한다)
Start-Job -ScriptBlock {
    param($url, $port)
    for ($i = 0; $i -lt 90; $i++) {
        $c = New-Object Net.Sockets.TcpClient
        try { $c.Connect('127.0.0.1', $port); $c.Close(); Start-Sleep -Seconds 2; Start-Process $url; return }
        catch { } finally { $c.Close() }
        Start-Sleep -Seconds 1
    }
} -ArgumentList $viewerUrl, $viewerPort | Out-Null

npx expo start --web --port $viewerPort

Write-Host ""
Read-Host "Enter 키를 누르면 창이 닫힙니다"
