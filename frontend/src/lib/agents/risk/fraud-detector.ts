import type { IAgent, AgentContext } from "../types";

// Track: secretHash → Set<IP>  (in prod: Redis TTL store)
const secretAttempts = new Map<string, Set<string>>();
const frozenContracts = new Set<string>();

export function recordAttempt(secretHex: string, ip: string): "ok" | "blocked" {
  if (frozenContracts.has(secretHex)) return "blocked";

  const ips = secretAttempts.get(secretHex) ?? new Set();
  ips.add(ip);
  secretAttempts.set(secretHex, ips);

  if (ips.size >= 2) {
    frozenContracts.add(secretHex);
    return "blocked";
  }
  return "ok";
}

export function isFrozen(contractId: string): boolean {
  return frozenContracts.has(contractId);
}

export const fraudDetector: IAgent = {
  name:       "FraudDetector",
  intervalMs: 5_000,

  async run(ctx) {
    // Scan for duplicate-IP release attempts (simulated with random probability)
    for (const d of ctx.deliveries.filter(d => d.status === "Active")) {
      // In prod: query an access-log store for release attempts on this contract
      if (Math.random() < 0.02) { // simulate 2% fraud event
        frozenContracts.add(d.contractId);
        ctx.emit({
          agent:   "FraudDetector",
          level:   "warn",
          message: `FRAUD detected on ${d.contractId.slice(0,8)} — same secret from multiple IPs. Contract frozen.`,
        });
      }
    }
  },
};
