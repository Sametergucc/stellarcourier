import type { IAgent, AgentContext, AgentConfig, Courier, Delivery } from "./types";
import { buildSignals }       from "./signals";
import { emit }               from "./log-store";
import { courierPricingAgent } from "./pricing/courier-agent";
import { dispatcherAgent }     from "./dispatch/dispatcher-agent";
import { fraudDetector }       from "./risk/fraud-detector";
import { expiryGuardian }      from "./risk/expiry-guardian";
import { geoFenceMonitor }     from "./risk/geo-fence";
import { autoRefundBot }       from "./payments/auto-refund-bot";
import { multiHopRouter }      from "./payments/multi-hop-router";
import { eventIndexer }        from "./data/event-indexer";
import { analyticsAgent }      from "./data/analytics-agent";
import { reputationScorer }    from "./data/reputation-scorer";
import { rpc } from "@stellar/stellar-sdk";
import { NETWORK }             from "$lib/network";

const server  = new rpc.Server(NETWORK.rpcUrl, { allowHttp: false });
const AGENTS: IAgent[] = [
  courierPricingAgent,
  dispatcherAgent,
  fraudDetector,
  expiryGuardian,
  geoFenceMonitor,
  autoRefundBot,
  multiHopRouter,
  eventIndexer,
  analyticsAgent,
  reputationScorer,
];

const DEFAULT_CONFIG: AgentConfig = {
  spendingLimitUsdc:       50_000_000n, // 50 USDC
  geoFenceRadiusKm:        10,
  minCourierRating:        3.0,
  maxDeliveriesPerCourier: 5,
  refundLedgerBuffer:      100,
};

export class AgentRunner {
  private timers: ReturnType<typeof setInterval>[] = [];
  private couriers:  Courier[]  = [];
  private deliveries: Delivery[] = [];
  private keyId      = "";
  private senderAddr = "";
  private config     = DEFAULT_CONFIG;

  configure(cfg: Partial<AgentConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  setIdentity(keyId: string, senderAddress: string) {
    this.keyId      = keyId;
    this.senderAddr = senderAddress;
  }

  setData(couriers: Courier[], deliveries: Delivery[]) {
    this.couriers   = couriers;
    this.deliveries = deliveries;
  }

  async start() {
    emit({ agent: "Runner", level: "info", message: `Starting ${AGENTS.length} agents…` });

    for (const agent of AGENTS) {
      const tick = async () => {
        try {
          const ledger = await server().getLatestLedger();
          const signals = await buildSignals(
            { lat: 41.01, lng: 28.97 }, // Istanbul default
            5,
            this.deliveries.filter(d => d.status === "Active").length,
            this.couriers.filter(c => !c.suspended).length,
          );

          const ctx: AgentContext = {
            couriers:      this.couriers,
            deliveries:    this.deliveries,
            currentLedger: ledger.sequence,
            signals,
            config:        this.config,
            keyId:         this.keyId,
            senderAddress: this.senderAddr,
            emit:          e => emit(e),
          };

          await agent.run(ctx);
        } catch (e: any) {
          emit({ agent: agent.name, level: "error", message: e?.message ?? String(e) });
        }
      };

      await tick(); // immediate first run
      this.timers.push(setInterval(tick, agent.intervalMs));
    }
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    emit({ agent: "Runner", level: "info", message: "All agents stopped." });
  }
}

export const runner = new AgentRunner();
