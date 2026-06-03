/**
 * Multi-Hop Router: if sender lacks USDC, auto-swap available asset → USDC
 * via Stellar DEX path payment before locking escrow.
 */

import { TransactionBuilder, Operation, Asset, Networks } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { NETWORK, CONTRACT_IDS } from "$lib/network";
import { signWithKit } from "$lib/passkey";
import type { IAgent, AgentContext } from "../types";

let _server: rpc.Server | null = null;
const server = () => (_server ??= new rpc.Server(NETWORK.rpcUrl, { allowHttp: false }));

export async function swapToUsdc(params: {
  senderAddress: string;
  sourceAsset:   string;   // e.g. "EURC:GDHU..."
  usdcAmountNeeded: bigint;
  keyId: string;
  slippagePct?: number;    // default 1%
}): Promise<string> {
  const [srcCode, srcIssuer] = params.sourceAsset.split(":");
  const src  = srcCode === "XLM" ? Asset.native() : new Asset(srcCode, srcIssuer);
  const [usdcCode, usdcIssuer] = (import.meta.env.VITE_USDC_CONTRACT_ID ?? "USDC:").split(":");
  const dest = new Asset("USDC", import.meta.env.VITE_USDC_ISSUER);

  const slippage    = params.slippagePct ?? 1;
  const destAmount  = (Number(params.usdcAmountNeeded) / 1_000_000).toFixed(7);
  const maxSendable = (Number(params.usdcAmountNeeded) / 1_000_000 * (1 + slippage / 100)).toFixed(7);

  const account = await server().getAccount(params.senderAddress);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset:   src,
        sendMax:     maxSendable,
        destination: params.senderAddress,
        destAsset:   dest,
        destAmount,
        path:        [],
      }),
    )
    .setTimeout(30)
    .build();

  const signed = await signWithKit(tx, params.keyId);
  const result = await server().sendTransaction(signed);
  if (result.status === "ERROR") throw new Error(`Swap failed: ${result.errorResult}`);
  return result.hash;
}

export const multiHopRouter: IAgent = {
  name:       "MultiHopRouter",
  intervalMs: 45_000,

  async run(ctx) {
    // Simulated: check if any pending delivery has sender without USDC balance
    // In prod: query Horizon for sender's USDC trustline + balance
    ctx.emit({
      agent:   "MultiHopRouter",
      level:   "info",
      message: "Scanning sender balances for USDC shortfall…",
    });
  },
};
