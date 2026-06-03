import type { IAgent, AgentContext, Courier } from "../types";

const BASE_PRICE_STROOP = 500_000n; // 0.5 USDC / km base

// ── Surge Pricing ─────────────────────────────────────────────────────────────
function surgeMultiplier(demandRatio: number): number {
  if (demandRatio > 4) return 1.8;
  if (demandRatio > 3) return 1.4;
  if (demandRatio > 2) return 1.2;
  return 1.0;
}

// ── Off-Peak Discount ─────────────────────────────────────────────────────────
function offPeakMultiplier(hour: number): number {
  if (hour >= 10 && hour <= 20) return 1.0;  // peak hours
  if (hour >= 22 || hour <= 6)  return 0.75; // deep off-peak
  return 0.9;
}

// ── Weather Premium ───────────────────────────────────────────────────────────
function weatherMultiplier(weather: string): number {
  if (weather === "stormy") return 1.5;
  if (weather === "rainy")  return 1.2;
  return 1.0;
}

export function computePrice(signals: AgentContext["signals"]): bigint {
  const multiplier =
    surgeMultiplier(signals.demandRatio) *
    offPeakMultiplier(signals.hourOfDay) *
    weatherMultiplier(signals.weather);
  return BigInt(Math.round(Number(BASE_PRICE_STROOP) * multiplier));
}

// Courier-specific price (accounts for their own base rate)
export function priceForCourier(courier: Courier, signals: AgentContext["signals"]): bigint {
  const multiplier =
    surgeMultiplier(signals.demandRatio) *
    offPeakMultiplier(signals.hourOfDay) *
    weatherMultiplier(signals.weather);
  return BigInt(Math.round(Number(courier.basePricePerKm) * multiplier));
}

// ── Agent ─────────────────────────────────────────────────────────────────────
export const courierPricingAgent: IAgent = {
  name:       "CourierAgent",
  intervalMs: 30_000,

  async run(ctx) {
    const price = computePrice(ctx.signals);
    const stroopsPerUsdc = 1_000_000n;

    ctx.emit({
      agent:   "CourierAgent",
      level:   "action",
      message: `Price updated → ${price / stroopsPerUsdc}.${(price % stroopsPerUsdc).toString().padStart(6,"0")} USDC/km | weather=${ctx.signals.weather} demand=${ctx.signals.demandRatio.toFixed(2)}x hour=${ctx.signals.hourOfDay}`,
    });

    // Update each active courier's effective price (in-memory; persist to DB in prod)
    for (const c of ctx.couriers.filter(c => !c.suspended)) {
      c.basePricePerKm = priceForCourier(c, ctx.signals);
    }
  },
};
