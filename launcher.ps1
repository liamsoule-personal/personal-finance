#Requires -Version 5.1
<#
.SYNOPSIS
    Personal Finance App - launcher.
    Installs uv and Node.js if needed, builds the frontend, installs Python deps,
    runs DB migrations, starts the server, then opens the browser.

.PARAMETER Rebuild
    Force a fresh React frontend build even if one already exists.
#>

param([switch]$Rebuild)

$ErrorActionPreference = 'Continue'
$ProjectRoot = $PSScriptRoot

# --- Helpers ------------------------------------------------------------------

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan   }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Info { param($msg) Write-Host "    [ ] $msg"  -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "    [X] $msg"  -ForegroundColor Red    }

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Test-Command { param($name) $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

# --- Step 1: Install uv -------------------------------------------------------

Write-Step "Checking uv (Python package manager)"

Refresh-Path

if (-not (Test-Command "uv")) {
    Write-Info "uv not found - installing via winget..."
    winget install --id astral-sh.uv --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
}

if (-not (Test-Command "uv")) {
    Write-Err "uv could not be found after install. Please restart this script."
    Read-Host "`nPress Enter to exit"
    exit 1
}

Write-Ok "uv is available: $(uv --version)"

# --- Step 2: Install Node.js --------------------------------------------------

Write-Step "Checking Node.js (needed to build the frontend)"

$staticIndex = Join-Path $ProjectRoot "src\web\static\index.html"
$needsBuild  = $Rebuild -or (-not (Test-Path $staticIndex))

if ($needsBuild -and (-not (Test-Command "node"))) {
    Write-Info "Node.js not found - installing via winget (this takes ~30 seconds)..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
}

if ($needsBuild -and (-not (Test-Command "node"))) {
    Write-Err "Node.js could not be found after install. Please restart this script."
    Read-Host "`nPress Enter to exit"
    exit 1
}

if (-not $needsBuild) {
    Write-Ok "Frontend already built - skipping Node.js check. (Run with -Rebuild to force a rebuild.)"
} else {
    Write-Ok "Node.js is available: $(node --version)"
}

# --- Step 3: Build React frontend ---------------------------------------------

Write-Step "Building React frontend"

if (-not $needsBuild) {
    Write-Ok "Skipping - using existing build in src\web\static."
} else {
    $webDir    = Join-Path $ProjectRoot "web"
    $distDir   = Join-Path $webDir "dist"
    $staticDir = Join-Path $ProjectRoot "src\web\static"

    Write-Info "Installing npm dependencies..."
    Push-Location $webDir
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Err "npm install failed."
        Read-Host "`nPress Enter to exit"
        exit 1
    }

    Write-Info "Building..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Err "npm run build failed."
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    Pop-Location

    # Copy dist -> src/web/static (where FastAPI expects it)
    if (Test-Path $staticDir) {
        Remove-Item $staticDir -Recurse -Force
    }
    Copy-Item $distDir $staticDir -Recurse
    Write-Ok "Frontend built and copied to src\web\static."
}

# --- Step 4: Python virtual environment + dependencies -----------------------

Write-Step "Setting up Python environment"

$venvDir = Join-Path $ProjectRoot ".venv"

if (-not (Test-Path (Join-Path $venvDir "Scripts\uvicorn.exe"))) {
    Write-Info "Creating virtual environment..."
    uv venv $venvDir --quiet
    Write-Info "Installing Python dependencies (one-time, ~20 seconds)..."
    uv pip install -r (Join-Path $ProjectRoot "requirements.txt") --python $venvDir --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Dependency installation failed."
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    Write-Ok "Python environment ready."
} else {
    Write-Info "Syncing dependencies..."
    uv pip install -r (Join-Path $ProjectRoot "requirements.txt") --python $venvDir --quiet
    Write-Ok "Python environment up to date."
}

# --- Step 5: Environment (.env) file -----------------------------------------

Write-Step "Checking environment configuration"

$envFile    = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Info ".env created from .env.example."
        Write-Info "Opening .env - fill in your Plaid credentials, save, then close Notepad to continue."
        Start-Process notepad.exe -ArgumentList $envFile -Wait
    } else {
        Write-Info "No .env file found. Plaid connection will not work without credentials."
    }
}

# Migrate old Docker absolute DB path to the local relative path
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match 'sqlite:////app/data') {
        Write-Info "Updating DATABASE_URL from Docker path to local path..."
        $envContent = $envContent -replace 'sqlite:////app/data/ledger\.db', 'sqlite:///data/ledger.db'
        [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::UTF8)
    }
    if ($envContent -match 'your_client_id_here|your_development_secret_here') {
        Write-Info "WARNING: .env still contains placeholder values - Plaid will not connect."
        Write-Info "Edit '$envFile' and replace the placeholders with your real credentials."
    } else {
        Write-Ok ".env is configured."
    }
}

# --- Step 6: Data directory + DB migrations -----------------------------------

Write-Step "Running database migrations"

$dataDir = Join-Path $ProjectRoot "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

$alembic = Join-Path $venvDir "Scripts\alembic.exe"
Set-Location $ProjectRoot

# Load DATABASE_URL from .env so alembic env.py picks it up
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

& $alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Err "Database migration failed."
    Read-Host "`nPress Enter to exit"
    exit 1
}
Write-Ok "Database is up to date."

# --- Step 7: Stop any existing server -----------------------------------------

$pidFile = Join-Path $ProjectRoot ".server.pid"
if (Test-Path $pidFile) {
    $oldPid = [int](Get-Content $pidFile -Raw).Trim()
    $existing = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Info "Stopping existing server (PID $oldPid)..."
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        Start-Sleep 1
    }
    Remove-Item $pidFile -Force
}

# --- Step 8: Start the server -------------------------------------------------

Write-Step "Starting Personal Finance server"

$uvicorn = Join-Path $venvDir "Scripts\uvicorn.exe"
$proc = Start-Process -FilePath $uvicorn `
    -ArgumentList "src.api.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Minimized `
    -PassThru

$proc.Id | Set-Content $pidFile -Encoding ASCII
Write-Ok "Server started (PID $($proc.Id))."

# --- Step 9: Wait for the app to respond -------------------------------------

Write-Step "Waiting for app to respond at http://localhost:8000"

$ready  = $false
$waited = 0
while ($waited -lt 30) {
    try {
        $r = Invoke-WebRequest http://localhost:8000 -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch {}
    Start-Sleep 1
    $waited += 1
    Write-Host "." -NoNewline
}
Write-Host ""

if (-not $ready) {
    Write-Err "App did not respond within 30 seconds."
    Write-Info "Check for errors in the server window (look for a minimized window in the taskbar)."
    Read-Host "`nPress Enter to exit"
    exit 1
}

Write-Ok "App is ready."

# --- Step 10: Create Desktop shortcuts (first run only) ----------------------

$shortcutPath = "$env:USERPROFILE\Desktop\Personal Finance.lnk"

if (-not (Test-Path $shortcutPath)) {
    Write-Step "Creating Desktop shortcuts"
    try {
        $wsh = New-Object -ComObject WScript.Shell

        $sc = $wsh.CreateShortcut($shortcutPath)
        $sc.TargetPath       = "powershell.exe"
        $sc.Arguments        = "-NoProfile -WindowStyle Normal -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        $sc.WorkingDirectory = $ProjectRoot
        $sc.Description      = "Launch Personal Finance App"
        $sc.IconLocation     = "%SystemRoot%\system32\shell32.dll, 154"
        $sc.Save()

        $stopPath = "$env:USERPROFILE\Desktop\Stop Personal Finance.lnk"
        $sc2 = $wsh.CreateShortcut($stopPath)
        $sc2.TargetPath       = "powershell.exe"
        $sc2.Arguments        = "-NoProfile -WindowStyle Normal -ExecutionPolicy Bypass -File `"$(Join-Path $ProjectRoot 'stop.ps1')`""
        $sc2.WorkingDirectory = $ProjectRoot
        $sc2.Description      = "Stop Personal Finance App"
        $sc2.IconLocation     = "%SystemRoot%\system32\shell32.dll, 131"
        $sc2.Save()

        Write-Ok "Desktop shortcuts created."
    } catch {
        Write-Info "Could not create shortcuts: $_"
    }
}

# --- Step 11: Open browser ---------------------------------------------------

Write-Step "Opening Personal Finance app"
Start-Process "http://localhost:8000"

Write-Host ""
Write-Host "  Personal Finance is running at http://localhost:8000" -ForegroundColor Green
Write-Host "  The server runs in a minimized window in your taskbar." -ForegroundColor DarkGray
Write-Host "  To stop it, double-click 'Stop Personal Finance' on your Desktop." -ForegroundColor DarkGray
Write-Host ""
