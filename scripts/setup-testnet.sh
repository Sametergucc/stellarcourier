#!/usr/bin/env bash
# Run from repo root. Outputs a ready-to-paste .env block at the end.
set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"

# ── 1. Identity ───────────────────────────────────────────────────────────────
stellar keys generate "$IDENTITY" --network "$NETWORK" 2>/dev/null || true
DEPLOYER_ADDR=$(stellar keys address "$IDENTITY")
echo "Deployer: $DEPLOYER_ADDR"

# ── 2. Fund via Friendbot ─────────────────────────────────────────────────────
curl -sf "https://friendbot.stellar.org?addr=$DEPLOYER_ADDR" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('Funded:', r.get('hash','ok'))"

# ── 3. Build escrow contract ──────────────────────────────────────────────────
stellar contract build --manifest-path contracts/escrow/Cargo.toml
ESCROW_WASM="target/wasm32-unknown-unknown/release/stellarcourier_escrow.wasm"

# ── 4. Deploy escrow ──────────────────────────────────────────────────────────
ESCROW_CONTRACT_ID=$(stellar contract deploy \
  --wasm    "$ESCROW_WASM" \
  --source  "$IDENTITY" \
  --network "$NETWORK")
echo "Escrow contract: $ESCROW_CONTRACT_ID"

# ── 5. Derive Testnet USDC SAC ────────────────────────────────────────────────
# Circle testnet issuer: https://developers.circle.com/stablecoins/usdc-contract-addresses
USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
USDC_CONTRACT_ID=$(stellar contract id asset \
  --asset   "USDC:$USDC_ISSUER" \
  --network "$NETWORK")
echo "USDC SAC: $USDC_CONTRACT_ID"
# Expected: CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# ── 6. Deploy passkey-kit factory + wallet ────────────────────────────────────
PASSKEY_DIR="/tmp/passkey-kit"
if [ ! -d "$PASSKEY_DIR" ]; then
  git clone --depth 1 https://github.com/kalepail/passkey-kit "$PASSKEY_DIR"
fi
pushd "$PASSKEY_DIR" > /dev/null

stellar contract build

# Install smart-wallet WASM → returns the hash used in PasskeyKit constructor
WALLET_WASM_HASH=$(stellar contract install \
  --wasm    target/wasm32-unknown-unknown/release/smart_wallet.wasm \
  --source  "$IDENTITY" \
  --network "$NETWORK")
echo "Wallet WASM hash: $WALLET_WASM_HASH"

# Deploy factory
FACTORY_CONTRACT_ID=$(stellar contract deploy \
  --wasm    target/wasm32-unknown-unknown/release/factory.wasm \
  --source  "$IDENTITY" \
  --network "$NETWORK")
echo "Factory: $FACTORY_CONTRACT_ID"

# Initialize factory with the wallet wasm hash
stellar contract invoke \
  --id      "$FACTORY_CONTRACT_ID" \
  --source  "$IDENTITY" \
  --network "$NETWORK" \
  -- init \
  --wasm_hash "$WALLET_WASM_HASH"

popd > /dev/null

# ── 7. Generate frontend bindings ─────────────────────────────────────────────
stellar contract bindings typescript \
  --wasm        "$ESCROW_WASM" \
  --contract-id "$ESCROW_CONTRACT_ID" \
  --output-dir  "packages/escrow-client" \
  --overwrite
cd packages/escrow-client && npm install && npm run build && cd -

# ── 8. Fund deployer with testnet USDC via Circle faucet ─────────────────────
echo ""
echo "→ Visit https://faucet.circle.com and mint USDC to: $DEPLOYER_ADDR"
echo ""

# ── 9. Print .env ─────────────────────────────────────────────────────────────
cat <<ENV

# ── paste into frontend/.env ──────────────────────────────────────────────────
VITE_ESCROW_CONTRACT_ID=$ESCROW_CONTRACT_ID
VITE_USDC_CONTRACT_ID=$USDC_CONTRACT_ID
VITE_PASSKEY_FACTORY_ID=$FACTORY_CONTRACT_ID
VITE_WALLET_WASM_HASH=$WALLET_WASM_HASH
# ─────────────────────────────────────────────────────────────────────────────
ENV
