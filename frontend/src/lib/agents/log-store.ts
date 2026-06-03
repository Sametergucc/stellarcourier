import { writable, derived } from "svelte/store";
import type { AgentLog } from "./types";
import { supabase } from "$lib/supabase";

const MAX_LOGS = 200;

export const logs = writable<AgentLog[]>([]);

export function emit(entry: Omit<AgentLog, "ts">) {
  logs.update(ls => [{ ...entry, ts: Date.now() }, ...ls].slice(0, MAX_LOGS));
  supabase.from("agent_logs").insert({
    agent:   entry.agent,
    level:   entry.level,
    message: entry.message,
  }).then();
}

export const logsByAgent = derived(logs, $logs =>
  $logs.reduce<Record<string, AgentLog[]>>((acc, l) => {
    (acc[l.agent] ??= []).push(l);
    return acc;
  }, {}),
);
