import type { IAgent, AgentContext } from "../types";
import { refundDelivery } from "$lib/escrow";

export const autoRefundBot: IAgent = {
  name:       "AutoRefundBot",
  intervalMs: 60_000,

  async run(ctx) {
    const expired = ctx.deliveries.filter(
      d => d.status === "Active" &&
           d.expiryLedger + ctx.config.refundLedgerBuffer < ctx.currentLedger,
    );

    for (const d of expired) {
      try {
        ctx.emit({ agent: "AutoRefundBot", level: "action", message: `Refunding expired escrow ${d.contractId.slice(0,8)} → sender ${d.sender.slice(0,8)}` });
        await refundDelivery({ sender: d.sender, keyId: ctx.keyId });
        d.status = "Refunded";
        ctx.emit({ agent: "AutoRefundBot", level: "info",   message: `Refund complete for ${d.contractId.slice(0,8)}` });
      } catch (e: any) {
        ctx.emit({ agent: "AutoRefundBot", level: "error",  message: `Refund failed: ${e?.message}` });
      }
    }

    if (!expired.length) {
      ctx.emit({ agent: "AutoRefundBot", level: "info", message: "No expired escrows found" });
    }
  },
};
