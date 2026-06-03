#!/usr/bin/env bash
set -euo pipefail

NETWORK="testnet"
SOURCE="alice"                # stellar keys add alice --network testnet
USDC_TESTNET="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"  # Circle Testnet USDC issuer → faucet.circle.com

# ── 1. Build ──────────────────────────────────────────────────────────────────
stellar contract build --manifest-path contracts/escrow/Cargo.toml

WASM="target/wasm32-unknown-unknown/release/stellarcourier_escrow.wasm"

# ── 2. Deploy ─────────────────────────────────────────────────────────────────
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --alias escrow)

echo "Contract: $CONTRACT_ID"

# ── 3. Generate frontend bindings ─────────────────────────────────────────────
stellar contract bindings typescript \
  --wasm "$WASM" \
  --contract-id "$CONTRACT_ID" \
  --output-dir packages/escrow-client \
  --overwrite

# ── 4. Initialize (Sender locks 10 USDC = 10_000_000 stroops) ────────────────
# Generate secret + hash off-chain:
#   SECRET=$(openssl rand -hex 16)
#   SECRET_HASH=$(echo -n "$SECRET" | openssl dgst -sha256 -binary | xxd -p -c 32)
#
# Then pass --secret_hash as 32-byte hex:
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --sender    "$(stellar keys address alice)" \
  --courier   "$COURIER_ADDRESS" \
  --token     "$USDC_TESTNET" \
  --amount    10000000 \
  --secret_hash "$SECRET_HASH_HEX" \
  --expiry_ledger 500000   # ~28 days at 5s/ledger

# ── 5. Release (Courier scans QR, submits plain secret) ───────────────────────
# stellar contract invoke \
#   --id "$CONTRACT_ID" \
#   --source courier_key \
#   --network "$NETWORK" \
#   -- release \
#   --courier "$COURIER_ADDRESS" \
#   --secret  "$(echo -n "$SECRET" | xxd -p)"

# ── 6. Refund (Sender after expiry) ───────────────────────────────────────────
# stellar contract invoke \
#   --id "$CONTRACT_ID" \
#   --source "$SOURCE" \
#   --network "$NETWORK" \
#   -- refund
