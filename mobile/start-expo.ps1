# 모바일 앱 휴대폰 연결(QR) 스크립트 — 앱실행.bat 이 호출한다.
# 주의: 한글이 깨지지 않도록 반드시 UTF-8 BOM으로 저장한다 (run.ps1과 동일 규칙).
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = '모션브릿지 모바일 앱 - QR'
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
Write-Host "   모션브릿지 모바일 앱 - 휴대폰 연결(QR)"
Write-Host "=============================================="
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
}

# 이미 켜져 있으면 창을 새로 만들지 않는다 — 창이 쌓이는 것을 막고, 포트 충돌도 피한다
if (Test-Port 8081) {
    Write-Host "휴대폰용 서버가 이미 켜져 있습니다." -ForegroundColor Yellow
    Write-Host "먼저 열어둔 검은 창에 QR이 그대로 있으니 그것을 스캔하세요."
    Write-Host "그 창을 찾을 수 없으면 종료.bat 을 눌러 전부 정리한 뒤 다시 실행하세요."
    Write-Host ""
    Read-Host "Enter 키를 누르면 이 창이 닫힙니다"
    exit 0
}

# ── 1. 앱 부품(의존성) 확인 ─────────────────────
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
    Write-Host "[1/3] 앱 부품 설치 중... (처음 한 번만, 1~2분)"
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "설치에 실패했습니다. 인터넷 연결을 확인하세요." }
} else {
    Write-Host "[1/3] 앱 부품 확인 완료"
}

# ── 2. ERP 서버(API 4000) 확인 ──────────────────
# 앱은 이 PC의 4000 포트에서 데이터를 가져온다. 꺼져 있으면 로그인이 안 된다.
$apiUp = $false
$sock = New-Object Net.Sockets.TcpClient
try { $sock.Connect('127.0.0.1', 4000); $apiUp = $true } catch { } finally { $sock.Close() }

if ($apiUp) {
    Write-Host "[2/3] ERP 서버 실행 중 — 정상"
} else {
    Write-Host "[2/3] ERP 서버가 꺼져 있습니다" -ForegroundColor Yellow
    Write-Host "      앱 화면은 열리지만 로그인·조회가 되지 않습니다."
    Write-Host "      상위 폴더의 실행.bat 을 먼저 실행해 주세요." -ForegroundColor Yellow
}

# ── 3. 이 PC의 주소 안내 ────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1).IPAddress
Write-Host "[3/3] 이 PC 주소: $ip"

Write-Host ""
Write-Host "----------------------------------------------"
Write-Host "  휴대폰에서 할 일"
Write-Host ""
Write-Host "   1) 'Expo Go' 앱 설치"
Write-Host "      - 아이폰: 앱스토어 / 안드로이드: 플레이스토어"
Write-Host "   2) 휴대폰 와이파이를 이 PC와 같은 곳으로 연결"
Write-Host "   3) 잠시 뒤 아래에 나오는 QR을 스캔"
Write-Host "      - 아이폰: 기본 카메라 앱으로 스캔"
Write-Host "      - 안드로이드: Expo Go 앱을 열고 그 안에서 스캔"
Write-Host ""
Write-Host "  이 창을 닫으면 휴대폰 연결도 끊깁니다."
Write-Host "  끝낼 때는 이 창에서 Ctrl+C 를 누르세요."
Write-Host "----------------------------------------------"
Write-Host ""

npx expo start

Write-Host ""
Read-Host "Enter 키를 누르면 창이 닫힙니다"
