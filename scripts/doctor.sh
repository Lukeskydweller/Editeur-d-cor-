#!/usr/bin/env bash
set -euo pipefail

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then QUICK=1; fi

echo "== Doctor: env checks =="
command -v node >/dev/null || { echo "Missing node"; exit 1; }
command -v pnpm >/dev/null || { echo "Missing pnpm"; exit 1; }
node -v
pnpm -v
if pnpm exec playwright --version >/dev/null 2>&1; then
  pnpm exec playwright --version
else
  echo "Playwright not installed (run: pnpm install)"
  exit 1
fi

echo "== Doctor: disk/memory =="
df -h / | tail -n +2
free -h || true

echo "== Doctor: port 5173 availability =="
if ss -ltn '( sport = :5173 )' | grep -q 5173; then
  echo "Port 5173 busy -> stopping preview"
  fuser -k 5173/tcp 2>/dev/null || true
  sleep 1
fi

if [[ "$QUICK" -eq 1 ]]; then
  echo "Quick mode: skipping preview launch."
  exit 0
fi

echo "== Doctor: start preview =="
pnpm e2e:preview:start >/tmp/dev.log 2>&1 & disown
sleep 2

echo "== Doctor: curl preview =="
if command -v curl >/dev/null; then
  set +e
  curl -sSf http://localhost:5173 >/dev/null
  EC=$?
  set -e
  if [[ $EC -ne 0 ]]; then
    echo "Preview not responding on :5173 (curl exit $EC). Check /tmp/dev.log"
    exit 2
  fi
  echo "Preview OK on :5173"
else
  echo "curl not found, skipping HTTP check"
fi

echo "== Doctor: stop preview =="
pnpm e2e:preview:stop
echo "Doctor done."
