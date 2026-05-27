#Requires -Version 5.1
<#
.SYNOPSIS
    Personal Finance App – launcher script.
    Installs Docker Desktop if missing, starts the app, and opens the browser.
    On first run it also creates a Desktop shortcut so you never need to touch this file again.
#>

param([switch]$AdminMode)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot      = $PSScriptRoot
$DockerDesktopExe = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"

# ── Helpers ────────────────────────────────────────────────────────────────────

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan   }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Info { param($msg) Write-Host "    [ ] $msg"  -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "    [X] $msg"  -ForegroundColor Red    }

function Test-IsAdmin {
    ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DockerCliAvailable {
    $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
}

function Test-DockerRunning {
    try {
        $output = & docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

# ── Step 1 – Install Docker Desktop if missing ────────────────────────────────

Write-Step "Checking Docker Desktop"

$dockerInstalled = (Test-DockerCliAvailable) -or (Test-Path $DockerDesktopExe)

if (-not $dockerInstalled) {
    Write-Info "Docker Desktop not found – installation required."

    if (-not (Test-IsAdmin)) {
        Write-Info "Requesting administrator privileges for installation..."
        $relaunch = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -AdminMode"
        Start-Process powershell.exe -Verb RunAs -ArgumentList $relaunch -Wait
        exit 0
    }

    # ── 1a. Ensure WSL2 feature is enabled ──────────────────────────────────
    Write-Info "Enabling WSL2 (required by Docker Desktop)..."
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
    if ($wslFeature -and $wslFeature.State -ne 'Enabled') {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart | Out-Null
    }
    $vmFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue
    if ($vmFeature -and $vmFeature.State -ne 'Enabled') {
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart | Out-Null
    }

    # ── 1b. Download & install Docker Desktop ───────────────────────────────
    $installer = "$env:TEMP\DockerDesktopInstaller.exe"
    Write-Info "Downloading Docker Desktop (this may take a few minutes)..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest `
        -Uri     "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
        -OutFile $installer `
        -UseBasicParsing

    Write-Info "Installing Docker Desktop – please follow any on-screen prompts..."
    Start-Process -FilePath $installer -ArgumentList "install --quiet --accept-license" -Wait
    Remove-Item $installer -Force -ErrorAction SilentlyContinue

    # Reload PATH so the docker CLI is visible in this session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Ok "Docker Desktop installed."
    Write-Info "If the app fails to start, a Windows restart may be needed for WSL2.  Reboot and re-run."
} else {
    Write-Ok "Docker Desktop is installed."
}

# ── Step 2 – Start Docker Desktop and wait for the daemon ─────────────────────

Write-Step "Checking Docker daemon"

if (-not (Test-DockerRunning)) {
    if (-not (Test-Path $DockerDesktopExe)) {
        Write-Err "Docker Desktop executable not found at '$DockerDesktopExe'."
        Write-Err "Please start Docker Desktop manually and re-run this script."
        Read-Host "`nPress Enter to exit"
        exit 1
    }

    Write-Info "Starting Docker Desktop..."
    Start-Process $DockerDesktopExe

    Write-Info "Waiting for Docker daemon (up to 90 s)..."
    $waited = 0
    while ($waited -lt 90) {
        Start-Sleep 3; $waited += 3
        Write-Host "." -NoNewline
        if (Test-DockerRunning) { break }
    }
    Write-Host ""
}

if (-not (Test-DockerRunning)) {
    Write-Err "Docker daemon did not start within 90 seconds."
    Write-Err "Open Docker Desktop from the Start menu, wait for it to show 'Running', then try again."
    Read-Host "`nPress Enter to exit"
    exit 1
}

Write-Ok "Docker daemon is ready."

# ── Step 3 – Environment (.env) file ──────────────────────────────────────────

Write-Step "Checking environment configuration"

$envFile    = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Info ".env created from .env.example."
        Write-Info "Opening .env – fill in your Plaid Client ID and Secret, save, then close Notepad to continue."
        Start-Process notepad.exe -ArgumentList $envFile -Wait
    } else {
        Write-Info "No .env file found. App may not connect to Plaid without credentials."
    }
}

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match 'your_client_id_here|your_development_secret_here') {
        Write-Info "WARNING: .env still contains placeholder values – Plaid connection will fail."
        Write-Info "Edit '$envFile' and replace the placeholder values with your real Plaid credentials."
    } else {
        Write-Ok ".env is configured."
    }
}

# ── Step 4 – Build & start the container ──────────────────────────────────────

Write-Step "Building and starting Personal Finance app"
Write-Info "(First run builds the Docker image – this takes ~2 minutes. Later runs are instant.)"

Set-Location $ProjectRoot

& docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker compose failed – see output above."
    Read-Host "`nPress Enter to exit"
    exit 1
}

Write-Ok "Container is up."

# ── Step 5 – Wait for the app to respond ──────────────────────────────────────

Write-Step "Waiting for app to respond at http://localhost:8000"

$ready  = $false
$waited = 0
while ($waited -lt 60) {
    try {
        $r = Invoke-WebRequest http://localhost:8000 -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch {}
    Start-Sleep 2; $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""

if (-not $ready) {
    Write-Err "App did not respond within 60 seconds."
    Write-Info "Run the following to inspect logs:"
    Write-Info "    docker compose -f `"$ProjectRoot\docker-compose.yml`" logs -f"
    Read-Host "`nPress Enter to exit"
    exit 1
}

Write-Ok "App is ready."

# ── Step 6 – Create Desktop shortcut (first run only) ─────────────────────────

$shortcutPath = "$env:USERPROFILE\Desktop\Personal Finance.lnk"

if (-not (Test-Path $shortcutPath)) {
    Write-Step "Creating Desktop shortcuts"
    try {
        $wsh = New-Object -ComObject WScript.Shell

        # Launch shortcut
        $sc  = $wsh.CreateShortcut($shortcutPath)
        $sc.TargetPath       = "powershell.exe"
        $sc.Arguments        = "-NoProfile -WindowStyle Normal -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        $sc.WorkingDirectory = $ProjectRoot
        $sc.Description      = "Launch Personal Finance App"
        $sc.IconLocation     = "%SystemRoot%\system32\shell32.dll, 154"
        $sc.Save()

        # Stop shortcut
        $stopShortcut = "$env:USERPROFILE\Desktop\Stop Personal Finance.lnk"
        $sc2 = $wsh.CreateShortcut($stopShortcut)
        $sc2.TargetPath       = "powershell.exe"
        $sc2.Arguments        = "-NoProfile -WindowStyle Normal -ExecutionPolicy Bypass -File `"$(Join-Path $ProjectRoot 'stop.ps1')`""
        $sc2.WorkingDirectory = $ProjectRoot
        $sc2.Description      = "Stop Personal Finance App"
        $sc2.IconLocation     = "%SystemRoot%\system32\shell32.dll, 131"
        $sc2.Save()

        Write-Ok "Desktop shortcuts created: 'Personal Finance' (launch) and 'Stop Personal Finance' (stop)."
    } catch {
        Write-Info "Could not create Desktop shortcuts: $_"
        Write-Info "You can run launcher.ps1 / stop.ps1 directly instead."
    }
}

# ── Step 7 – Open browser ──────────────────────────────────────────────────────

Write-Step "Opening Personal Finance app"
Start-Process "http://localhost:8000"

Write-Host ""
Write-Host "  Personal Finance is running at http://localhost:8000" -ForegroundColor Green
Write-Host "  To stop the app, run stop.ps1 (or double-click 'Stop Personal Finance' on your Desktop)." -ForegroundColor DarkGray
Write-Host ""
