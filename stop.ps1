#Requires -Version 5.1
<#
.SYNOPSIS
    Personal Finance App – stop script.
    Shuts down the running Docker container gracefully.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan  }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Err  { param($msg) Write-Host "    [X] $msg"  -ForegroundColor Red   }

function Test-DockerRunning {
    try {
        $null = & docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

Write-Step "Stopping Personal Finance app"

if (-not (Test-DockerRunning)) {
    Write-Ok "Docker is not running – nothing to stop."
    Start-Sleep 2
    exit 0
}

Set-Location $ProjectRoot
& docker compose down

if ($LASTEXITCODE -eq 0) {
    Write-Ok "App stopped successfully."
} else {
    Write-Err "docker compose down reported an error – see output above."
}

Write-Host ""
Start-Sleep 2
