#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# trade-monitor — setup & startup script
# ──────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/setup.sh            # interactive setup
#   ./scripts/setup.sh --quick    # skip prompts, just install + dev
#   ./scripts/setup.sh --prod     # build + run production container
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

check_dependency() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is not installed. Install it first: $2"
    exit 1
  fi
  ok "$1 found"
}

check_node_version() {
  local min_major=20
  local node_ver
  node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_ver" -lt "$min_major" ]; then
    err "Node.js v$min_major+ required (found v$(node -v))"
    exit 1
  fi
  ok "Node.js $(node -v)"
}

install_deps() {
  info "Installing dependencies..."
  npm ci
  ok "Dependencies installed"
}

setup_env() {
  if [ -f .env ]; then
    warn ".env already exists — skipping"
    return
  fi
  cp .env.example .env
  info "Created .env from .env.example"
  info "Edit .env with your API keys (see linked URLs in the file)"
}

quick_summary() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Trade Monitor — Setup Complete${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  Dev server:   npm run dev"
  echo "  API server:   npm run dev:api"
  echo "  Both:         npm run dev:full"
  echo "  All (+term):  npm run dev:all"
  echo ""
  echo -e "  ${YELLOW}Required keys for full functionality:${NC}"
  echo "    FINNHUB_API_KEY   → finnhub.io/register"
  echo "    GITHUB_PAT        → github.com/settings/tokens"
  echo "    SNAPTRADE_*       → dashboard.snaptrade.com"
  echo "    FRED_API_KEY      → fred.stlouisfed.org"
  echo "    FEISHU_APP_ID     → open.feishu.cn/app"
  echo "    OPENROUTER_API_KEY → openrouter.ai/keys"
  echo ""
  echo "  Quick links:"
  echo "    http://localhost:5173  (dashboard)"
  echo "    http://localhost:3000  (API server)"
  echo ""
}

# ==============================================================

MODE="${1:-interactive}"

info "Checking prerequisites..."
check_dependency "node" "https://nodejs.org/en/download/"
check_dependency "npm"  "(bundled with Node.js)"
check_node_version

case "$MODE" in
  --quick|-q)
    setup_env
    install_deps
    quick_summary
    info "Starting dev server..."
    exec npm run dev
    ;;

  --prod|-p)
    setup_env
    info "Building Docker image..."
    docker compose build app
    ok "Build complete"
    info "Starting production container..."
    exec docker compose up app
    ;;

  *)
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║        Trade Monitor — Setup Wizard          ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    setup_env

    echo ""
    info "Install dependencies? [Y/n]"
    read -r REPLY
    if [[ "$REPLY" =~ ^[Nn] ]]; then
      warn "Skipping dependency install"
    else
      install_deps
    fi

    echo ""
    info "Edit .env now with your API keys? [Y/n]"
    read -r REPLY
    if [[ ! "$REPLY" =~ ^[Nn] ]]; then
      editor="${EDITOR:-nano}"
      if command -v "$editor" &>/dev/null; then
        $editor .env
      else
        warn "No editor found — manually edit .env"
      fi
    fi

    echo ""
    info "Verify API keys with test connection? [y/N]"
    read -r REPLY
    if [[ "$REPLY" =~ ^[Yy] ]]; then
      echo ""
      info "Starting API server in background to run tests..."
      npx tsx server/index.ts &
      API_PID=$!
      sleep 2

      keys_to_test=("finnhub" "newsapi" "github" "openrouter" "snaptrade" "fred" "reddit")
      for svc in "${keys_to_test[@]}"; do
        result=$(curl -s "http://localhost:3000/api/health?action=test-key&service=${svc}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('ok') else f'FAIL: {d.get(\"message\",\"?\")}')" 2>/dev/null || echo "SKIP")
        if [[ "$result" == OK ]]; then
          ok "  ${svc} → ${result}"
        else
          warn "  ${svc} → ${result}"
        fi
      done

      kill "$API_PID" 2>/dev/null || true
    fi

    quick_summary
    echo ""
    info "Start dev server now? [Y/n]"
    read -r REPLY
    if [[ "$REPLY" =~ ^[Nn] ]]; then
      info "Run 'npm run dev' when ready"
    else
      info "Starting dev server..."
      exec npm run dev
    fi
    ;;
esac
