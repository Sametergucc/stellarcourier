import type { IAgent, AgentContext, Courier } from "../types";

// Weights: on-time delivery, low dispute rate, high volume
const W_ONTIME = 0.5;
const W_DISPUTE = 0.3;
const W_VOLUME = 0.2;

interface CourierStats {
  address:        string;
  onTimeRate:     number; // 0–1
  disputeRate:    number; // 0–1 (lower = better)
  completedCount: number;
}

// In prod: pull from Mercury-indexed events or off-chain DB
function simulateStats(courier: Courier, deliveries: AgentContext["deliveries"]): CourierStats {
  const mine      = deliveries.filter(d => d.courier === courier.address);
  const released  = mine.filter(d => d.status === "Released").length;
  const refunded  = mine.filter(d => d.status === "Refunded").length;
  const total     = mine.length || 1;
  return {
    address:        courier.address,
    onTimeRate:     released / total,
    disputeRate:    refunded / total,
    completedCount: released,
  };
}

function computeScore(stats: CourierStats): number {
  const score =
    stats.onTimeRate   *  W_ONTIME  * 5 +
    (1 - stats.disputeRate) * W_DISPUTE * 5 +
    Math.min(stats.completedCount / 20, 1) * W_VOLUME * 5;
  return Math.round(score * 10) / 10;
}

export const reputationScorer: IAgent = {
  name:       "ReputationScorer",
  intervalMs: 60_000,

  async run(ctx) {
    for (const courier of ctx.couriers) {
      const stats    = simulateStats(courier, ctx.deliveries);
      const newScore = computeScore(stats);
      const prev     = courier.rating;
      courier.rating = newScore;

      if (newScore < ctx.config.minCourierRating && !courier.suspended) {
        courier.suspended = true;
        ctx.emit({
          agent:   "ReputationScorer",
          level:   "warn",
          message: `Courier ${courier.address.slice(0,8)} suspended — score dropped to ${newScore} (min: ${ctx.config.minCourierRating})`,
        });
      } else {
        ctx.emit({
          agent:   "ReputationScorer",
          level:   "info",
          message: `${courier.address.slice(0,8)} score: ${prev} → ${newScore}`,
        });
      }
    }
  },
};
