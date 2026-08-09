<#
Removes the scheduled task created by install-startup-task.ps1, and stops
the relay-server process it's running (if any).
#>

$ErrorActionPreference = "Stop"
$taskName = "RonanRelayServer"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "No '$taskName' task found — nothing to do."
    exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Removed scheduled task '$taskName'."
