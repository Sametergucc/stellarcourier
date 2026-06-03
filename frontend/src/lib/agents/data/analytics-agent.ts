import type { IAgent, AgentContext } from "../types";
import { writable } from "svelte/store";

export interface Analytics {
  totalDeliveries:  number;
  completed:        number;
  refunded:         number;
  avgAmountUsdc:    number;
  successRate:      number;
  avgActiveCouriers: number;
  lastUpdated:      number;
}

export const analytics = writable<Analytics>({
  totalDeliveries: 0, completed: 0, refunded: 0,
  avgAmountUsdc: 0, successRate: 0, avgActiveCouriers: 0, lastUpdated: 0,
});

export const analyticsAgent: IAgent = {
  name:       "Analytics",
  intervalMs: 30_000,

  async run(ctx) {
    const total     = ctx.deliveries.length;
    const completed = ctx.deliveries.filter(d => d.status === "Released").length;
    const refunded  = ctx.deliveries.filter(d => d.status === "Refunded").length;
    const avgAmt    = total
      ? ctx.deliveries.reduce((s, d) => s + Number(d.amount), 0) / total / 1_000_000
      : 0;
    const activeCouriers = ctx.couriers.filter(c => !c.suspended).length;

    const snapshot: Analytics = {
      totalDeliveries:   total,
      completed,
      refunded,
      avgAmountUsdc:     Math.round(avgAmt * 100) / 100,
      successRate:       total ? Math.round((completed / total) * 1000) / 10 : 0,
      avgActiveCouriers: activeCouriers,
      lastUpdated:       Date.now(),
    };

    analytics.set(snapshot);
    ctx.emit({
      agent:   "Analytics",
      level:   "info",
      message: `Deliveries: ${total} | ✓ ${completed} | ↩ ${refunded} | success: ${snapshot.successRate}%`,
    });
  },
};
