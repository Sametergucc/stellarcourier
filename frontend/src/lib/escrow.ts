import { Client as EscrowClient } from "escrow-client";
import { rpc } from "@stellar/stellar-sdk";
import { signWithKit } from "./passkey";
import { NETWORK, CONTRACT_IDS, DEFAULT_EXPIRY_LEDGERS } from "./network";

let _server: rpc.Server | null = null;
const server = () => (_server ??= new rpc.Server(NETWORK.rpcUrl, { allowHttp: false }));

function client(publicKey: string): EscrowClient {
  return new EscrowClient({
    contractId:        CONTRACT_IDS.escrow,
    rpcUrl:            NETWORK.rpcUrl,
    networkPassphrase: NETWORK.networkPassphrase,
    publicKey,
  });
}

async function signAndSubmit(
  tx: Awaited<ReturnType<EscrowClient["initialize"]>>,
  keyId: string,
) {
  const signed = await signWithKit(tx.built!, keyId);
  return server().sendTransaction(signed as any);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initializeDelivery(params: {
  sender:        string;
  courier:       string;
  amountUsdc:    bigint;        // in stroops (1 USDC = 1_000_000)
  secretHash:    Uint8Array;   // SHA-256(QR secret), 32 bytes
  keyId:         string;
  expiryLedgers?: number;
}) {
  const c = client(params.sender);
  const ledger = await server().getLatestLedger();

  const tx = await c.initialize({
    sender:        params.sender,
    courier:       params.courier,
    token:         CONTRACT_IDS.usdc,
    amount:        params.amountUsdc,
    secret_hash:   Buffer.from(params.secretHash),
    expiry_ledger: ledger.sequence + (params.expiryLedgers ?? DEFAULT_EXPIRY_LEDGERS),
  });

  return signAndSubmit(tx, params.keyId);
}

export async function releaseDelivery(params: {
  courier: string;
  secret:  Uint8Array;   // plain-text bytes from QR scan
  keyId:   string;
}) {
  const c = client(params.courier);
  const tx = await c.release({
    courier: params.courier,
    secret:  Buffer.from(params.secret),
  });
  return signAndSubmit(tx, params.keyId);
}

export async function refundDelivery(params: {
  sender: string;
  keyId:  string;
}) {
  const c = client(params.sender);
  const tx = await c.refund();
  return signAndSubmit(tx, params.keyId);
}

export async function getEscrowState(publicKey: string) {
  return client(publicKey).get_state();
}
