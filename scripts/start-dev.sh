#!/usr/bin/env bash
# scripts/start-dev.sh – DIPON PIM Dev-Start (Linux/macOS)
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/data"
[ ! -d "$ROOT/node_modules" ] && cd "$ROOT" && npm install
echo "  🚀 DIPON PIM – Electron Dev"
cd "$ROOT" && npx electron-vite dev
