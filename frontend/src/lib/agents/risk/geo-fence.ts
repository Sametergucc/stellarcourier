import type { IAgent, AgentContext } from "../types";
import { haversineKm } from "../signals";

export const geoFenceMonitor: IAgent = {
  name:       "GeoFence",
  intervalMs: 15_000,

  async run(ctx) {
    for (const delivery of ctx.deliveries.filter(d => d.status === "Active")) {
      const courier = ctx.couriers.find(c => c.address === delivery.courier);
      if (!courier) continue;

      const dist = haversineKm(courier.location, delivery.location);

      if (dist > ctx.config.geoFenceRadiusKm) {
        ctx.emit({
          agent:   "GeoFence",
          level:   "warn",
          message: `Courier ${courier.address.slice(0,8)} is ${dist.toFixed(1)} km from delivery zone (limit: ${ctx.config.geoFenceRadiusKm} km). Flagging for refund.`,
        });

        // In prod: trigger automatic refund or re-dispatch
        // await refundDelivery({ sender: delivery.sender, keyId: ctx.keyId });
      } else {
        ctx.emit({
          agent:   "GeoFence",
          level:   "info",
          message: `Courier ${courier.address.slice(0,8)} in zone — ${dist.toFixed(1)} km from drop-off`,
        });
      }
    }
  },
};
