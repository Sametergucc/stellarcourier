# StellarCourier

A blockchain-based secure courier and delivery protocol. The sender locks USDC in a Stellar Soroban escrow contract; when the courier delivers and scans the recipient's QR code, payment is released automatically. If delivery does not complete, funds are refunded to the sender. There is no bank or platform in the middle.

**Repository:** [github.com/Sametergucc/stellarcourier](https://github.com/Sametergucc/stellarcourier)

### Deployed Contracts (Stellar Testnet)

| Contract | ID |
| --- | --- |
| Escrow | `CAU3L6VLBKVXNCHKLWPFDFP4QFFDTO7KSKRPAHUASIMGZCD4WEAFG7UF` |
| USDC (SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

---

## Table of Contents

- [Why StellarCourier](#why-stellarcourier)
- [The Agent Layer](#the-agent-layer) ← the heart of the project
  - [How the agents run](#how-the-agents-run)
  - [Shared context every agent receives](#shared-context-every-agent-receives)
  - [The 10 agents in detail](#the-10-agents-in-detail)
  - [x402 — agentic payments](#x402--agentic-payments)
  - [The live agent dashboard](#the-live-agent-dashboard)
- [Roles and User Flow](#roles-and-user-flow)
- [Technology](#technology)
- [Product Highlights](#product-highlights)
- [Database Schema](#database-schema)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Disclaimer](#disclaimer)

---

## Why StellarCourier

Traditional courier payments force users to trust a courier or a platform with their money. StellarCourier keeps funds in a smart-contract escrow until delivery is cryptographically confirmed by a QR handoff. Trust risk and platform commission exposure are removed — the money only moves when the package does.

But an escrow alone is not a marketplace. A real delivery network has to **price** jobs as demand shifts, **match** the right courier to each job, **watch** for fraud and out-of-zone behaviour, **refund** the sender when something goes wrong, and **score** couriers over time. StellarCourier does all of this with an **autonomous agent layer** that runs in the background, with no human in the loop.

---

## The Agent Layer

> **This is the core of the project.** Ten independent agents run continuously in the browser session, each on its own timer, each with a single responsibility. Together they turn a bare escrow contract into a self-operating delivery marketplace — pricing, dispatching, policing, paying, and learning, entirely on their own.

### How the agents run

All agents are orchestrated by a single `AgentRunner` (`frontend/src/lib/agents/runner.ts`). The runner:

1. **Registers all ten agents** in one array and starts them with `runner.start()`.
2. **Gives each agent its own `setInterval` timer** — agents tick independently at their own cadence (from 5 s to 60 s), so a slow agent never blocks a fast one.
3. **Runs every agent once immediately** on start, then on its interval, so the dashboard is populated without waiting a full cycle.
4. **Builds a fresh signal snapshot every tick** — current ledger sequence (from Soroban RPC), live weather, demand ratio, hour of day — and passes it to the agent.
5. **Isolates failures**: each tick is wrapped in `try/catch`, so a crashing agent logs an `error` entry and the others keep running.
6. Can be reconfigured at runtime via `runner.configure({...})` and given an identity via `runner.setIdentity(keyId, senderAddress)` so payment-capable agents can sign transactions.

```
runner.start()
  └─ for each of 10 agents:
        tick() ──► getLatestLedger()  ──► buildSignals()  ──► agent.run(ctx)  ──► emit(log)
        └─ setInterval(tick, agent.intervalMs)
```

Every action an agent takes is written to a shared **log store** (`log-store.ts`), which both keeps the last 200 entries in memory for the live UI **and** persists each entry to the `agent_logs` table in Supabase for an auditable history.

### Shared context every agent receives

Each agent implements one tiny interface:

```ts
interface IAgent {
  name:       string;
  intervalMs: number;
  run(ctx: AgentContext): Promise<void>;
}
```

On every tick it is handed an `AgentContext` containing everything it needs:

| Field | What it carries |
|-------|-----------------|
| `couriers` | Live courier list — location, rating, active load, base rate, suspended flag |
| `deliveries` | Live deliveries — amount, expiry ledger, status (`Active`/`Released`/`Refunded`), location |
| `currentLedger` | The latest Soroban ledger sequence — the on-chain clock used for expiry math |
| `signals` | `{ weather, demandRatio, hourOfDay, distanceKm }` — the pricing inputs |
| `config` | Tunable policy: spending limit, geo-fence radius, min rating, max jobs/courier, refund buffer |
| `keyId` / `senderAddress` | Identity used by agents that sign and submit Stellar transactions |
| `emit(log)` | Structured logging callback (info / warn / action / error) |

The default policy (`DEFAULT_CONFIG`) ships with: spending limit **50 USDC**, geo-fence **10 km**, min courier rating **3.0**, max **5** concurrent deliveries per courier, and a **100-ledger** refund safety buffer.

### The 10 agents in detail

| # | Agent | Interval | Category | One-line job |
|---|-------|----------|----------|--------------|
| 1 | **CourierAgent** | 30 s | Pricing | Dynamic surge pricing from demand, weather, and time of day |
| 2 | **Dispatcher** | 10 s | Dispatch | Auto-assign the best-scoring courier to each open job |
| 3 | **FraudDetector** | 5 s | Risk | Freeze contracts when one secret is redeemed from multiple IPs |
| 4 | **ExpiryGuardian** | 60 s | Risk | Warn before escrows expire; flag the expired ones |
| 5 | **GeoFence** | 15 s | Risk | Alert/flag when a courier leaves the delivery zone |
| 6 | **AutoRefundBot** | 60 s | Payments | Automatically refund escrows that have expired on-chain |
| 7 | **MultiHopRouter** | 45 s | Payments | DEX path-payment swap → USDC when the sender lacks it |
| 8 | **EventIndexer** | 10 s | Data | Poll Soroban RPC for contract events and index them |
| 9 | **Analytics** | 30 s | Data | Aggregate success rate, volume, and average amounts |
| 10 | **ReputationScorer** | 60 s | Data | Re-score couriers and suspend chronic low performers |

---

#### 1. CourierAgent — dynamic surge pricing  · `pricing/courier-agent.ts` · every 30 s

The pricing brain. Starting from a base of **0.5 USDC/km**, it multiplies three independent signals to reach an effective price:

- **Surge multiplier** by demand ratio (active deliveries ÷ active couriers): `>4 → 1.8×`, `>3 → 1.4×`, `>2 → 1.2×`, otherwise `1.0×`.
- **Off-peak multiplier** by hour: peak (10:00–20:00) `1.0×`, deep off-peak (22:00–06:00) `0.75×`, shoulder hours `0.9×`.
- **Weather premium**: `stormy → 1.5×`, `rainy → 1.2×`, `sunny → 1.0×`.

On each tick it logs the new price together with the inputs that produced it, then writes the recalculated rate back onto every non-suspended courier so the rest of the system prices jobs consistently.

#### 2. Dispatcher — intelligent matching  · `dispatch/dispatcher-agent.ts` · every 10 s

For each open (`Active`) delivery it:

1. **Filters eligible couriers** — not suspended, rating ≥ `minCourierRating`, and below `maxDeliveriesPerCourier`.
2. **Scores and sorts them** with a weighted formula — `distance × 0.5 + load × 0.3 − rating × 0.2` — so the nearest, least-loaded, highest-rated courier wins.
3. **Enforces the spending-limit guard** — if the computed price (rate × Haversine distance) exceeds the configured limit, the job is skipped and logged rather than dispatched.
4. **Dispatches** the best courier and increments their active load.

This is the agent that demonstrates *autonomous intent*: in the full flow, the actual escrow release still requires the delivery secret from the QR scan, so the agent prepares and routes the job but never pays without proof of delivery.

#### 3. FraudDetector — anti-double-spend  · `risk/fraud-detector.ts` · every 5 s

The fastest agent, because fraud is time-sensitive. It tracks, per delivery secret, the set of IP addresses that attempt to redeem it (`recordAttempt`). **The moment a single secret is seen from two or more IPs, the contract is frozen** — a classic signal that the QR/secret has leaked. Frozen contracts reject further release attempts (`isFrozen`). The agent loop also continuously scans active deliveries for suspicious release patterns and freezes anything that trips the heuristic.

#### 4. ExpiryGuardian — deadline watcher  · `risk/expiry-guardian.ts` · every 60 s

Converts on-chain ledger distance into human time (≈5 s/ledger). For each active delivery it computes `expiryLedger − currentLedger` and:

- If **already past expiry**, logs a warning and hands off to the AutoRefundBot.
- If **expiring within ~2 hours** (1 440 ledgers), warns and notifies the sender so they can act before funds are auto-refunded.

#### 5. GeoFence — zone enforcement  · `risk/geo-fence.ts` · every 15 s

For each active delivery it measures the Haversine distance between the assigned courier's live location and the drop-off point. If the courier drifts beyond `geoFenceRadiusKm` (default **10 km**), it raises a warning and flags the job for refund or re-dispatch; otherwise it logs an in-zone heartbeat with the live distance. This catches couriers going off-route or abandoning a job.

#### 6. AutoRefundBot — automatic sender protection  · `payments/auto-refund-bot.ts` · every 60 s

The agent that actually moves money back. It selects deliveries that are still `Active` but whose `expiryLedger + refundLedgerBuffer` is already behind the current ledger (the buffer prevents premature refunds near the boundary), then calls the on-chain `refundDelivery(...)` for each, marks them `Refunded`, and logs success or failure per contract. Senders get their USDC back with **no support ticket and no manual step**.

#### 7. MultiHopRouter — liquidity router  · `payments/multi-hop-router.ts` · every 45 s

If a sender wants to pay in USDC but holds a different asset (XLM, EURC, …), this agent bridges the gap. `swapToUsdc(...)` builds a Stellar **`pathPaymentStrictReceive`** operation that swaps the source asset to the exact USDC amount needed through the DEX, with configurable slippage (default 1 %), then signs and submits it. The recurring loop scans sender balances for a USDC shortfall so the escrow can always be funded in the right asset.

#### 8. EventIndexer — on-chain event feed  · `data/event-indexer.ts` · every 10 s

Polls Soroban RPC for events emitted by the escrow contract, starting from the last ledger it saw (or the latest minus 100 on cold start). New events are parsed into a typed `ContractEvent` shape and pushed into a Svelte store capped at 500 entries, giving the UI a live, contract-level audit trail. In production this is meant to be swapped for a Mercury/Zephyr indexer webhook.

#### 9. Analytics — live KPIs  · `data/analytics-agent.ts` · every 30 s

Aggregates the whole delivery set into a snapshot: total deliveries, completed, refunded, average amount (USDC), **success rate**, and average active couriers. The result is written to an `analytics` store and surfaced on the dashboard, so the operator always has current marketplace health at a glance.

#### 10. ReputationScorer — courier quality control  · `data/reputation-scorer.ts` · every 60 s

Recomputes every courier's reputation from on-time rate (weight 0.5), inverse dispute/refund rate (0.3), and capped volume (0.2), scaled to a 0–5 score. **If a courier's score falls below `minCourierRating`, they are automatically suspended** — which immediately removes them from the Dispatcher's eligible pool. This closes the loop: bad behaviour lowers the score, a low score stops new jobs.

### x402 — agentic payments

Beyond the ten background agents, StellarCourier implements the **[x402 agentic payment protocol](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide)** (`payments/x402-client.ts`). This lets an agent pay for a metered HTTP resource autonomously:

1. The agent requests a protected endpoint.
2. The server replies **HTTP 402 Payment Required** with `{ recipient, amount, asset, memo }`.
3. The agent builds, signs, and submits the matching Stellar payment.
4. It retries the request with an `X-Payment-Hash` proof header and gets the resource.

This is the rail for machine-to-machine payments — an agent buying weather data, routing data, or any pay-per-call service without a human reaching for a credit card.

### The live agent dashboard

Visit **`/agents`** to watch the whole layer operate in real time: a streaming feed of every agent's `info` / `warn` / `action` / `error` logs (grouped by agent), the live analytics snapshot, and the indexed contract events. Because every emit is also persisted to the `agent_logs` table, the activity is fully auditable after the fact.

---

## Roles and User Flow

| Role | Route | User journey |
|------|-------|--------------|
| **Sender** | `/send` | Select pickup and drop-off on the map, enter amount, choose a courier, lock USDC, share a WhatsApp link with the recipient |
| **Courier** | `/courier` | Register vehicle and license plate, browse nearby jobs, accept a job, scan QR code, receive payment in wallet |
| **Recipient** | `/receive` | Open the delivery link, show QR code to the courier, confirm handoff |

---

## Technology

| Layer | Stack |
|-------|-------|
| Frontend | SvelteKit, Svelte 5 (runes) |
| Agent layer | TypeScript agents on independent timers, orchestrated by `AgentRunner` |
| Blockchain | Stellar Soroban escrow contract (Rust) |
| Stablecoin | USDC on testnet |
| Agentic payments | x402 protocol + DEX path payments |
| Authentication | Supabase with Google OAuth |
| Database | Supabase PostgreSQL |
| Maps | Leaflet (Istanbul coverage) |
| Wallet | Deterministic Stellar keypair derived from user ID (testnet demo mode) |

---

## Product Highlights

- **Ten autonomous agents** running the marketplace end to end — pricing, dispatch, fraud, refunds, analytics, reputation
- Live agent activity dashboard at `/agents` with persisted, auditable logs
- Turkish and English UI toggle in the navigation bar
- Pickup from current GPS location
- Courier density heat map (red, yellow, green zones)
- Live package updates through Supabase Realtime
- Dynamic surge pricing driven by agents
- Automatic wallet linking with fault-tolerant transaction handling

---

## Database Schema

Initialize with `supabase/schema.sql`:

| Table | Purpose |
|-------|---------|
| **users** | Profile: name, phone, gender, date of birth, `stellar_address` |
| **couriers** | Vehicle info, per-km rate, trust score, rating, earnings, live location |
| **courier_vehicles** | License plate, make, model, year, color |
| **deliveries** | Sender, courier, coordinates, amount, status, escrow contract reference |
| **agent_logs** | Structured logs streamed from the background agents |
| **fraud_events** | Records flagged by the FraudDetector layer |

Optional patches: `patch_rls.sql`, `patch_stellar_address.sql`, `seed_couriers.sql`.

---

## Repository Layout

```
stellarcourier/
├── contracts/escrow/              # Soroban escrow contract (Rust)
├── frontend/
│   └── src/lib/agents/            # ◄ the agent layer
│       ├── runner.ts              #    orchestrator + timers
│       ├── types.ts               #    IAgent / AgentContext contracts
│       ├── signals.ts             #    weather, demand, Haversine helpers
│       ├── log-store.ts           #    in-memory + Supabase log sink
│       ├── pricing/               #    CourierAgent
│       ├── dispatch/              #    Dispatcher
│       ├── risk/                  #    FraudDetector, ExpiryGuardian, GeoFence
│       ├── payments/              #    AutoRefundBot, MultiHopRouter, x402 client
│       └── data/                  #    EventIndexer, Analytics, ReputationScorer
├── packages/escrow-client/
├── scripts/                       # Testnet setup, deploy, e2e tests, bindings
└── supabase/                      # SQL schema and seed data
```

---

## Getting Started

### Step 1: Testnet and smart contract

```bash
./scripts/setup-testnet.sh
```

Deploy the contract and generate client bindings:

```bash
./scripts/deploy.sh
./scripts/generate-bindings.sh
```

### Step 2: Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. Apply patch and seed scripts if your environment needs them. The `agent_logs` table must exist for the agent dashboard to persist activity.

### Step 3: Frontend

```bash
cd frontend
cp .env.example .env
```

Populate `VITE_*` variables using the output from the testnet setup script, then start the dev server:

```bash
npm run dev
```

Environment variables in `.env.example` include the escrow contract ID, USDC contract address, **OpenWeather API key** (the CourierAgent uses it for real weather-based pricing; without it the signal is simulated), and server-side Twilio credentials for notifications.

The agents start automatically with the app — open `/agents` to watch them work.

---

## Disclaimer

This project is intended for hackathons and demonstrations. Several agents use simulated inputs (fraud probability, balance checks) where a production build would query real access logs and Horizon balances. Production deployments require a full security review, a server-side agent runtime, and mainnet configuration.
