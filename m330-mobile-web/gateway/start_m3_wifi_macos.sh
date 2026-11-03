#!/bin/sh
# Run: sh start_m3_wifi_macos.sh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js 20+ with npm is required. Install Node.js and rerun."
  exit 1
fi
if ! command -v python3 >/dev/null; then
  echo "Python 3 is required."
  exit 1
fi
if [ ! -f node_modules/@tuyapi/link/package.json ]; then
  echo "Installing Tuya Wi-Fi EZ pairing library..."
  npm install --ignore-scripts --omit=dev --no-audit --no-fund
fi
( sleep 1; open 'http://127.0.0.1:8765/' ) &
python3 m3_wifi_local.py
