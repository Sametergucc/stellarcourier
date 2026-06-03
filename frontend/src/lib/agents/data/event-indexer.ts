/**
 * Event Indexer: polls Soroban RPC for contract events and appends to in-memory store.
 * In prod: replace with Mercury / Zephyr indexer webhook.
 */

import { rpc } from "@stellar/stellar-sdk";
import { NETWORK, CONTRACT_IDS } from "$lib/network";
import type { IAgent, AgentContext } from "../types";
import { writable } from "svelte/store";

let _server: rpc.Server | null = null;
const server = () => (_server ??= new rpc.Server(NETWORK.rpcUrl, { allowHttp: false }));

export interface ContractEvent {
  type:       string;
  contractId: string;
  ledger:     number;
  data:       unknown;
}

export const contractEvents = writable<ContractEvent[]>([]);
let lastLedger = 0;

export const eventIndexer: IAgent = {
  name:       "EventIndexer",
  intervalMs: 10_000,

  async run(ctx) {
    try {
      const latest = await server().getLatestLedger();
      const from   = lastLedger || latest.sequence - 100;

      const resp = await server().getEvents({
        startLedger: from,
        filters: [{
          type:        "contract",
          contractIds: [CONTRACT_IDS.escrow],
        }],
        limit: 50,
      } as any);

      if (resp.events?.length) {
        const parsed: ContractEvent[] = resp.events.map((e: any) => ({
          type:       e.type,
          contractId: e.contractId,
          ledger:     e.ledger,
          data:       e.value,
        }));
        contractEvents.update(ev => [...parsed, ...ev].slice(0, 500));
        ctx.emit({
          agent:   "EventIndexer",
          level:   "info",
          message: `Indexed ${parsed.length} event(s) from ledger ${from}→${latest.sequence}`,
        });
      }

      lastLedger = latest.sequence;
    } catch (e: any) {
      ctx.emit({ agent: "EventIndexer", level: "error", message: e?.message });
    }
  },
};
