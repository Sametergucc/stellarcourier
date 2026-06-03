/**
 * x402 Payment Protocol client for Stellar.
 * Spec: https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide
 *
 * Flow:
 *  1. Agent requests a resource endpoint.
 *  2. Server responds HTTP 402 with { recipient, amount, asset, memo }.
 *  3. Agent submits a Stellar payment and retries with X-Payment-Hash header.
 */

import { TransactionBuilder, Operation, Asset, Networks, Keypair } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { NETWORK } from "$lib/network";
import { signWithKit } from "$lib/passkey";

let _server: rpc.Server | null = null;
const server = () => (_server ??= new rpc.Server(NETWORK.rpcUrl, { allowHttp: false }));

export interface PaymentRequired {
  recipient: string;
  amount:    string;    // decimal USDC
  asset:     string;    // "USDC:ISSUER"
  memo?:     string;
  network:   string;
}

export async function x402Fetch(
  url:     string,
  init:    RequestInit = {},
  keyId:   string,
  senderAddress: string,
): Promise<Response> {
  // ── Step 1: probe ────────────────────────────────────────────────────────────
  const probe = await fetch(url, {
    ...init,
    headers: { ...init.headers as Record<string,string>, "X-Stellar-Address": senderAddress },
  });

  if (probe.status !== 402) return probe;

  // ── Step 2: parse payment requirements ───────────────────────────────────────
  const req: PaymentRequired = await probe.json();

  // ── Step 3: build + sign + submit Stellar payment ────────────────────────────
  const [assetCode, assetIssuer] = req.asset.split(":");
  const asset = assetCode === "XLM" ? Asset.native() : new Asset(assetCode, assetIssuer);

  const account = await server().getAccount(senderAddress);
  const ledger  = await server().getLatestLedger();

  const txBuilder = new TransactionBuilder(account, {
    fee:              "1000000",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(Operation.payment({ destination: req.recipient, asset, amount: req.amount }))
    .setTimeout(30);

  if (req.memo) txBuilder.addMemo({ value: req.memo } as any);

  const tx     = txBuilder.build();
  const signed = await signWithKit(tx, keyId);
  const result = await server().sendTransaction(signed);

  if (result.status === "ERROR") throw new Error(`x402 payment failed: ${result.errorResult}`);

  // ── Step 4: retry with payment proof ─────────────────────────────────────────
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers as Record<string,string>,
      "X-Stellar-Address": senderAddress,
      "X-Payment-Hash":    result.hash,
    },
  });
}
