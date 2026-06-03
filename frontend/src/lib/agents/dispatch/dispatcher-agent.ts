import type { IAgent, AgentContext, Courier, Delivery } from "../types";
import { haversineKm } from "../signals";
import { releaseDelivery } from "$lib/escrow";

// ── Rating Filter ─────────────────────────────────────────────────────────────
function filterEligible(couriers: Courier[], config: AgentContext["config"]): Courier[] {
  return couriers.filter(
    c =>
      !c.suspended &&
      c.rating >= config.minCourierRating &&
      c.activeDeliveries < config.maxDeliveriesPerCourier,
  );
}

// ── Load Balancer ─────────────────────────────────────────────────────────────
function sortByScore(couriers: Courier[], delivery: Delivery): Courier[] {
  return [...couriers].sort((a, b) => {
    const distA = haversineKm(a.location, delivery.location);
    const distB = haversineKm(b.location, delivery.location);
    const loadA = a.activeDeliveries / 5;
    const loadB = b.activeDeliveries / 5;
    // Score: lower distance + lower load + higher rating wins
    const scoreA = distA * 0.5 + loadA * 0.3 - a.rating * 0.2;
    const scoreB = distB * 0.5 + loadB * 0.3 - b.rating * 0.2;
    return scoreA - scoreB;
  });
}

// ── Spending Limit Guard ──────────────────────────────────────────────────────
function withinLimit(price: bigint, limit: bigint): boolean {
  return price <= limit;
}

// ── Auto-Dispatch ─────────────────────────────────────────────────────────────
async function dispatch(
  delivery: Delivery,
  ctx: AgentContext,
): Promise<void> {
  if (delivery.status !== "Active") return;

  const eligible = filterEligible(ctx.couriers, ctx.config);
  if (!eligible.length) {
    ctx.emit({ agent: "Dispatcher", level: "warn", message: `No eligible couriers for ${delivery.contractId.slice(0,8)}` });
    return;
  }

  const sorted  = sortByScore(eligible, delivery);
  const best    = sorted[0];
  const distKm  = haversineKm(best.location, delivery.location);
  const price   = BigInt(Math.round(Number(best.basePricePerKm) * distKm));

  if (!withinLimit(price, ctx.config.spendingLimitUsdc)) {
    ctx.emit({
      agent:   "Dispatcher",
      level:   "warn",
      message: `Price ${price} exceeds spending limit ${ctx.config.spendingLimitUsdc} for ${delivery.contractId.slice(0,8)} — skipped`,
    });
    return;
  }

  ctx.emit({
    agent:   "Dispatcher",
    level:   "action",
    message: `Dispatching ${best.address.slice(0,8)}… → delivery ${delivery.contractId.slice(0,8)} | dist=${distKm.toFixed(1)}km price=${price}`,
  });

  // In real flow: courier scans QR → secret arrives → this auto-submits within limit
  // Here we demonstrate the autonomous intent; actual release requires the secret.
  best.activeDeliveries++;
}

// ── Agent ─────────────────────────────────────────────────────────────────────
export const dispatcherAgent: IAgent = {
  name:       "Dispatcher",
  intervalMs: 10_000,

  async run(ctx) {
    const pending = ctx.deliveries.filter(d => d.status === "Active");
    for (const delivery of pending) {
      await dispatch(delivery, ctx);
    }
  },
};
