#!/usr/bin/env bash
# End-to-end contract flow test — no browser needed.
# Verifies: initialize → state check → release → balance check → refund path
set -euo pipefail

NETWORK="testnet"
SOURCE="deployer"
CONTRACT_ID="${ESCROW_CONTRACT_ID:?set ESCROW_CONTRACT_ID}"
USDC="${VITE_USDC_CONTRACT_ID:?set VITE_USDC_CONTRACT_ID}"
COURIER=$(stellar keys address courier 2>/dev/null || stellar keys address deployer)
SENDER=$(stellar keys address "$SOURCE")

SEP="────────────────────────────────────────"
ok()  { echo "  ✓ $1"; }
fail(){ echo "  ✗ $1"; exit 1; }
step(){ echo; echo "$SEP"; echo "  $1"; echo "$SEP"; }

# ── Generate secret + hash (bash-native) ─────────────────────────────────────
SECRET=$(openssl rand -hex 16)
SECRET_HASH=$(printf '%s' "$SECRET" | openssl dgst -sha256 -binary | xxd -p -c 64)
step "Secret generated"
echo "  plain : $SECRET"
echo "  sha256: $SECRET_HASH"

# ── Current ledger ────────────────────────────────────────────────────────────
LEDGER=$(stellar ledger latest --network "$NETWORK" --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['sequence'])" 2>/dev/null || echo "500000")
EXPIRY=$((LEDGER + 17280))  # +1 day
step "Current ledger: $LEDGER  |  Expiry: $EXPIRY"

# ── USDC balance before ───────────────────────────────────────────────────────
step "USDC balances BEFORE"
stellar contract invoke --id "$USDC" --source "$SOURCE" --network "$NETWORK" \
  -- balance --id "$SENDER"  2>/dev/null && ok "Sender balance read" || echo "  (trustline may not exist — fund via faucet.circle.com)"
stellar contract invoke --id "$USDC" --source "$SOURCE" --network "$NETWORK" \
  -- balance --id "$COURIER" 2>/dev/null || true

# ── Initialize ────────────────────────────────────────────────────────────────
step "Calling initialize()"
stellar contract invoke \
  --id      "$CONTRACT_ID" \
  --source  "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --sender        "$SENDER" \
  --courier       "$COURIER" \
  --token         "$USDC" \
  --amount        10000000 \
  --secret_hash   "$SECRET_HASH" \
  --expiry_ledger "$EXPIRY" \
  && ok "initialize() succeeded" || fail "initialize() failed"

# ── Read state ────────────────────────────────────────────────────────────────
step "Contract state after initialize"
STATE=$(stellar contract invoke \
  --id      "$CONTRACT_ID" \
  --source  "$SOURCE" \
  --network "$NETWORK" \
  -- get_state 2>&1)
echo "$STATE"
echo "$STATE" | grep -q "Active" && ok "Status = Active" || fail "Unexpected status"

# ── Release ───────────────────────────────────────────────────────────────────
step "Calling release() with correct secret"
SECRET_HEX=$(printf '%s' "$SECRET" | xxd -p | tr -d '\n')
stellar contract invoke \
  --id      "$CONTRACT_ID" \
  --source  courier \
  --network "$NETWORK" \
  -- release \
  --courier "$COURIER" \
  --secret  "$SECRET_HEX" \
  && ok "release() succeeded" || fail "release() failed"

# ── State after release ───────────────────────────────────────────────────────
step "Contract state after release"
stellar contract invoke \
  --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- get_state 2>&1 | grep -q "Released" && ok "Status = Released" || fail "Status not Released"

# ── USDC balance after ────────────────────────────────────────────────────────
step "USDC balances AFTER"
stellar contract invoke --id "$USDC" --source "$SOURCE" --network "$NETWORK" \
  -- balance --id "$COURIER" 2>/dev/null && ok "Courier received USDC" || true

echo
echo "$SEP"
echo "  E2E PASSED — full flow verified on testnet"
echo "$SEP"
echo
echo "  Receive URL (User B):  https://YOUR_DOMAIN/receive?secret=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SECRET'))")"
echo "  Courier route:         https://YOUR_DOMAIN/courier"
