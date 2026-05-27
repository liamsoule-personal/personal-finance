#Requires -Version 5.1
<#
.SYNOPSIS
    Personal Finance App - stop script.
    Kills the running uvicorn server process.
#>

$ErrorActionPreference = 'Continue'
$ProjectRoot = $PSScriptRoot
$pidFile     = Join-Path $ProjectRoot ".server.pid"

function Write-Ok  { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Info { param($msg) Write-Host "    [ ] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "    [X] $msg" -ForegroundColor Red    }

Write-Host "`n==> Stopping Personal Finance server" -ForegroundColor Cyan

if (-not (Test-Path $pidFile)) {
    Write-Info "No running server found (.server.pid does not exist)."
    Start-Sleep 2
    exit 0
}

$serverPid = $null
try { $serverPid = [int](Get-Content $pidFile -Raw).Trim() } catch {}

if ($null -eq $serverPid) {
    Write-Info "Could not read PID from .server.pid."
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Start-Sleep 2
    exit 0
}

$proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($null -eq $proc) {
    Write-Info "Process $serverPid is not running (may have already stopped)."
    Remove-Item $pidFile -Force
    Start-Sleep 2
    exit 0
}

try {
    Stop-Process -Id $serverPid -Force
    Remove-Item $pidFile -Force
    Write-Ok "Server stopped (was PID $serverPid)."
} catch {
    Write-Err "Could not stop process $serverPid`: $_"
}

Write-Host ""
Start-Sleep 2
