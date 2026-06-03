import type { IAgent, AgentContext } from "../types";

const LEDGER_PER_SEC = 0.2; // ~5 s/ledger

function ledgersToMinutes(ledgers: number): number {
  return Math.round((ledgers / LEDGER_PER_SEC) / 60);
}

export const expiryGuardian: IAgent = {
  name:       "ExpiryGuardian",
  intervalMs: 60_000,

  async run(ctx) {
    for (const d of ctx.deliveries.filter(d => d.status === "Active")) {
      const remaining = d.expiryLedger - ctx.currentLedger;

      if (remaining <= 0) {
        ctx.emit({
          agent:   "ExpiryGuardian",
          level:   "warn",
          message: `Delivery ${d.contractId.slice(0,8)} EXPIRED — triggering AutoRefundBot`,
        });
        continue;
      }

      if (remaining < 1_440) { // < ~2 hours
        ctx.emit({
          agent:   "ExpiryGuardian",
          level:   "warn",
          message: `Delivery ${d.contractId.slice(0,8)} expires in ~${ledgersToMinutes(remaining)} min — notify sender ${d.sender.slice(0,8)}`,
        });
      }
    }
  },
};
