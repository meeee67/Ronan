<#
Installs a Windows Scheduled Task that starts relay-server automatically
at logon and restarts it if it ever crashes — so it survives reboots and
you don't need to keep a terminal window open for it.

Run this once, from an elevated (Administrator) PowerShell, from inside
the relay-server folder:

    cd relay-server
    powershell -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1

To remove it later: scripts\uninstall-startup-task.ps1
#>

$ErrorActionPreference = "Stop"

$relayDir = (Get-Location).Path
if (-not (Test-Path (Join-Path $relayDir "server.js"))) {
    throw "Run this from inside the relay-server folder (server.js not found in $relayDir)."
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    throw "node isn't on PATH. Install Node.js first (nodejs.org), then re-run this script."
}

$taskName = "RonanRelayServer"

$action = New-ScheduledTaskAction -Execute $nodeCmd.Source -Argument "server.js" -WorkingDirectory $relayDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Auto-starts the Ronan/Jarvis relay server at logon and restarts it if it crashes." -Force | Out-Null

Write-Host "Installed scheduled task '$taskName'. Starting it now..."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo | Format-List LastRunTime, LastTaskResult

Write-Host ""
Write-Host "Check it's actually listening: curl http://localhost:3001/healthz"
