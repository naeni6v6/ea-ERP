# 일일 자동 백업을 Windows 작업 스케줄러에 등록한다. 한 번만 실행하면 된다.
# 해제:  Unregister-ScheduledTask -TaskName 'MotionBridge ERP 일일백업' -Confirm:$false
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script = Join-Path $root 'scripts\backup.ps1'
$taskName = 'MotionBridge ERP 일일백업'

if (-not (Test-Path $script)) { throw "백업 스크립트를 찾을 수 없습니다: $script" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At '13:00'
# StartWhenAvailable — 그 시각에 PC가 꺼져 있었으면 다음에 켜질 때 밀린 백업을 수행한다
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'MotionBridge ERP 데이터베이스 일일 백업 (backups 폴더, 최근 14개 보관)' -Force | Out-Null

Write-Host "등록 완료: $taskName (매일 13:00)"
Write-Host "지금 바로 실행해 보려면:  Start-ScheduledTask -TaskName '$taskName'"
