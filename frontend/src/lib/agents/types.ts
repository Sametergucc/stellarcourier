export interface LatLng { lat: number; lng: number }

export interface Courier {
  address:          string;
  rating:           number;       // 0–5
  location:         LatLng;
  activeDeliveries: number;
  basePricePerKm:   bigint;       // USDC stroops
  suspended:        boolean;
}

export interface Delivery {
  contractId:   string;
  sender:       string;
  courier:      string;
  amount:       bigint;
  expiryLedger: number;
  status:       "Active" | "Released" | "Refunded";
  location:     LatLng;
}

export type Weather = "sunny" | "rainy" | "stormy";

export interface PricingSignals {
  weather:      Weather;
  demandRatio:  number;   // activeDeliveries / activeCouriers
  hourOfDay:    number;
  distanceKm:   number;
}

export interface AgentLog {
  ts:      number;
  agent:   string;
  level:   "info" | "warn" | "action" | "error";
  message: string;
}

export interface AgentConfig {
  spendingLimitUsdc: bigint;
  geoFenceRadiusKm:  number;
  minCourierRating:  number;
  maxDeliveriesPerCourier: number;
  refundLedgerBuffer: number;   // refund this many ledgers before real expiry
}

export interface IAgent {
  name:     string;
  intervalMs: number;
  run(ctx: AgentContext): Promise<void>;
}

export interface AgentContext {
  couriers:      Courier[];
  deliveries:    Delivery[];
  currentLedger: number;
  signals:       PricingSignals;
  config:        AgentConfig;
  keyId:         string;
  senderAddress: string;
  emit:          (log: Omit<AgentLog, "ts">) => void;
}
