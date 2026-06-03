#!/usr/bin/env bash
set -euo pipefail

# Run from repo root after: stellar contract deploy ...
# Requires: ESCROW_CONTRACT_ID env var

WASM="target/wasm32-unknown-unknown/release/stellarcourier_escrow.wasm"
OUT="packages/escrow-client"

stellar contract build --manifest-path contracts/escrow/Cargo.toml

stellar contract bindings typescript \
  --wasm    "$WASM" \
  --contract-id "${ESCROW_CONTRACT_ID:?ESCROW_CONTRACT_ID is required}" \
  --output-dir  "$OUT" \
  --overwrite

cd "$OUT" && npm install && npm run build
echo "Bindings ready → $OUT/dist"
