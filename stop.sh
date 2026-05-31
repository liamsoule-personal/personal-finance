#!/usr/bin/env bash
# Personal Finance App — stop the running server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

printf "\n${CYAN}==> Stopping Personal Finance server${NC}\n"

if [[ ! -f "$PID_FILE" ]]; then
  printf "    ${YELLOW}[ ]${NC} No running server found (.server.pid does not exist).\n"
  exit 0
fi

SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)

if [[ -z "$SERVER_PID" ]]; then
  printf "    ${YELLOW}[ ]${NC} Could not read PID from .server.pid.\n"
  rm -f "$PID_FILE"
  exit 0
fi

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  printf "    ${YELLOW}[ ]${NC} Process %s is not running (may have already stopped).\n" "$SERVER_PID"
  rm -f "$PID_FILE"
  exit 0
fi

if kill "$SERVER_PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  printf "    ${GREEN}[OK]${NC} Server stopped (was PID %s).\n" "$SERVER_PID"
else
  printf "    ${RED}[X]${NC} Could not stop process %s.\n" "$SERVER_PID"
  exit 1
fi

printf "\n"
