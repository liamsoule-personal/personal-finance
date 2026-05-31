#!/usr/bin/env bash
# Personal Finance App — launcher for macOS / Linux
# Usage: ./launcher.sh [--rebuild]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { printf "\n${CYAN}==> %s${NC}\n" "$1"; }
ok()   { printf "    ${GREEN}[OK]${NC} %s\n" "$1"; }
info() { printf "    ${YELLOW}[ ]${NC} %s\n" "$1"; }
err()  { printf "    ${RED}[X]${NC} %s\n" "$1"; }

REBUILD=false
for arg in "$@"; do [[ "$arg" == "--rebuild" ]] && REBUILD=true; done

# ---------------------------------------------------------------------------
# Step 1 — uv
# ---------------------------------------------------------------------------
step "Checking uv (Python package manager)"

# Add common install locations so we find uv immediately after a fresh install
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

if ! command -v uv &>/dev/null; then
  info "uv not found — installing via official installer..."
  # Explicit error message if the download fails (e.g. no network)
  curl -LsSf https://astral.sh/uv/install.sh | sh || {
    err "Failed to download or install uv. Check your internet connection and try again."
    exit 1
  }
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi

if ! command -v uv &>/dev/null; then
  err "uv could not be found after install."
  err "Open a new terminal and re-run this script, or add ~/.local/bin to your PATH."
  exit 1
fi

ok "uv is available: $(uv --version)"

# ---------------------------------------------------------------------------
# Step 2 — Node.js
# ---------------------------------------------------------------------------
step "Checking Node.js (needed to build the frontend)"

STATIC_INDEX="$SCRIPT_DIR/src/web/static/index.html"
NEEDS_BUILD=true
[[ "$REBUILD" == false && -f "$STATIC_INDEX" ]] && NEEDS_BUILD=false

if [[ "$NEEDS_BUILD" == true ]]; then
  if ! command -v node &>/dev/null; then
    info "Node.js not found — attempting install..."
    if command -v brew &>/dev/null; then
      # Use || true so a non-fatal brew error (e.g. stale tap) doesn't abort the
      # script via set -e before we get to check whether node actually installed.
      brew install node || true
    else
      err "Node.js is required but not installed, and Homebrew was not found."
      err "Install Node.js from https://nodejs.org  or run: brew install node"
      exit 1
    fi
  fi

  if ! command -v node &>/dev/null; then
    err "Node.js still not found after install. Install from https://nodejs.org and re-run."
    exit 1
  fi
  ok "Node.js: $(node --version)"
else
  ok "Frontend already built — skipping Node.js check. (Run with --rebuild to force a rebuild.)"
fi

# ---------------------------------------------------------------------------
# Step 3 — Build React frontend
# ---------------------------------------------------------------------------
step "Building React frontend"

if [[ "$NEEDS_BUILD" == false ]]; then
  ok "Skipping — using existing build in src/web/static."
else
  info "Installing npm dependencies..."
  pushd "$SCRIPT_DIR/web" > /dev/null
  # --loglevel=error keeps progress noise quiet but still surfaces real errors
  npm install --loglevel=error
  info "Building..."
  npm run build
  popd > /dev/null

  STATIC_DIR="$SCRIPT_DIR/src/web/static"
  rm -rf "$STATIC_DIR"
  mkdir -p "$(dirname "$STATIC_DIR")"
  cp -r "$SCRIPT_DIR/web/dist" "$STATIC_DIR"
  ok "Frontend built and copied to src/web/static."
fi

# ---------------------------------------------------------------------------
# Step 4 — Python virtual environment + dependencies
# ---------------------------------------------------------------------------
step "Setting up Python environment"

VENV_DIR="$SCRIPT_DIR/.venv"

if [[ ! -f "$VENV_DIR/bin/uvicorn" ]]; then
  info "Creating virtual environment..."
  uv venv "$VENV_DIR" --quiet
  info "Installing Python dependencies (one-time, ~20 seconds)..."
  uv pip install -r "$SCRIPT_DIR/requirements.txt" --python "$VENV_DIR" --quiet
  ok "Python environment ready."
else
  info "Syncing dependencies..."
  uv pip install -r "$SCRIPT_DIR/requirements.txt" --python "$VENV_DIR" --quiet
  ok "Python environment up to date."
fi

# ---------------------------------------------------------------------------
# Step 5 — .env file
# ---------------------------------------------------------------------------
step "Checking environment configuration"

ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    info ".env created from .env.example."
  else
    info "No .env file found. Plaid connection will not work without credentials."
  fi
fi

# Migrate old Docker absolute path if present
if [[ -f "$ENV_FILE" ]] && grep -q 'sqlite:////app/data' "$ENV_FILE"; then
  info "Updating DATABASE_URL from Docker path to local path..."
  sed -i.bak 's|sqlite:////app/data/ledger\.db|sqlite:///data/ledger.db|g' "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
fi

if [[ -f "$ENV_FILE" ]] && grep -qE 'your_client_id_here|your_development_secret_here' "$ENV_FILE"; then
  info "Plaid credentials are placeholders — you will be prompted to enter them in the app."
else
  ok ".env is configured."
fi

# ---------------------------------------------------------------------------
# Step 6 — Data directory + DB migrations
# ---------------------------------------------------------------------------
step "Running database migrations"

mkdir -p "$SCRIPT_DIR/data"

# Source .env so alembic picks up DATABASE_URL
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

"$VENV_DIR/bin/alembic" upgrade head
ok "Database is up to date."

# ---------------------------------------------------------------------------
# Step 7 — Stop any existing server on port 8000
# ---------------------------------------------------------------------------
PID_FILE="$SCRIPT_DIR/.server.pid"

# Kill our previously tracked server if it is still running
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  # Guard against an empty or corrupt PID file
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    info "Stopping existing server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# Check whether something else is already holding port 8000
if lsof -i :8000 -sTCP:LISTEN -t &>/dev/null; then
  err "Port 8000 is already in use by another process."
  err "Stop that process first, or run on a different port."
  lsof -i :8000 -sTCP:LISTEN
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 8 — Start the server
# ---------------------------------------------------------------------------
step "Starting Personal Finance server"

LOG_FILE="$SCRIPT_DIR/.server.log"
nohup "$VENV_DIR/bin/uvicorn" src.api.main:app \
  --host 127.0.0.1 --port 8000 \
  > "$LOG_FILE" 2>&1 &

SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
ok "Server started (PID $SERVER_PID). Logs → .server.log"

# ---------------------------------------------------------------------------
# Step 9 — Wait for server to respond
# ---------------------------------------------------------------------------
step "Waiting for app to respond at http://localhost:8000"

READY=false
for i in $(seq 1 30); do
  # If the process already died, show the log immediately instead of
  # waiting out the full 30-second timeout.
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf "\n"
    err "Server process exited unexpectedly. Last log output:"
    tail -20 "$LOG_FILE" | sed 's/^/    /'
    exit 1
  fi

  if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
  printf "."
done
printf "\n"

if [[ "$READY" == false ]]; then
  err "App did not respond within 30 seconds."
  info "Last log output:"
  tail -20 "$LOG_FILE" | sed 's/^/    /'
  exit 1
fi

ok "App is ready."

# ---------------------------------------------------------------------------
# Step 10 — Open browser
# ---------------------------------------------------------------------------
step "Opening Personal Finance app"
if command -v open &>/dev/null; then
  open "http://localhost:8000"        # macOS
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:8000"    # Linux
fi

printf "\n"
printf "  ${GREEN}Personal Finance is running at http://localhost:8000${NC}\n"
printf "  Server logs: %s\n" "$LOG_FILE"
printf "  To stop the server: ./stop.sh\n"
printf "\n"
