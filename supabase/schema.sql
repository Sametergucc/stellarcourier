-- ══════════════════════════════════════════════════════════════════
--  StellarCourier — Supabase Schema
-- ══════════════════════════════════════════════════════════════════

-- ── 1. USERS ────────────────────────────────────────────────────────
-- Extends auth.users with profile fields
create table if not exists public.users (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  name        text        not null default '',
  phone       text,                             -- GSM numarası
  gender      text        check (gender in ('male', 'female', 'other')),
  birth_date  date,                             -- yaş hesabı için
  wallet_enc  text,                             -- AES-GCM şifreli Stellar secret
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: own row"
  on public.users for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 2. COURIERS ─────────────────────────────────────────────────────
create table if not exists public.couriers (
  id            uuid        primary key references public.users(id) on delete cascade,
  vehicle       text        not null check (vehicle in ('moto', 'car', 'commercial')),
  price_per_km  numeric(10,4) not null default 8.5,
  trust_score   numeric(5,2)  not null default 75,   -- 0–100 (ReputationScorer yazar)
  rating        numeric(3,2)  not null default 0,    -- 0–5   (ReputationScorer yazar)
  commission    numeric(5,4)  not null default 0.07,
  active        boolean       not null default false,
  suspended     boolean       not null default false,
  earnings      numeric(14,6) not null default 0,
  deliveries    int           not null default 0,
  -- Agent metrics (ReputationScorer günceller)
  on_time_rate  numeric(5,4)  not null default 0,    -- 0–1
  dispute_rate  numeric(5,4)  not null default 0,    -- 0–1 (düşük = iyi)
  location      jsonb,                               -- {lat, lng}
  created_at    timestamptz   not null default now()
);

alter table public.couriers enable row level security;

-- Herkes aktif kuryeleri görebilir
create policy "couriers: public read active"
  on public.couriers for select
  using (active = true);

-- Kurye kendi satırını yönetir
create policy "couriers: own row"
  on public.couriers for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 3. COURIER_VEHICLES (Plaka + Araç Bilgileri) ────────────────────
create table if not exists public.courier_vehicles (
  id           uuid        primary key default gen_random_uuid(),
  courier_id   uuid        not null references public.couriers(id) on delete cascade,
  plate        text        not null unique,      -- Plaka (örn: 34ABC123)
  brand        text,                             -- Marka (Honda, Toyota…)
  model        text,                             -- Model (PCX, Corolla…)
  year         smallint,                         -- Üretim yılı
  color        text,                             -- Renk
  vehicle_type text        not null check (vehicle_type in ('moto', 'car', 'commercial')),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.courier_vehicles enable row level security;

create policy "vehicles: public read"
  on public.courier_vehicles for select
  using (true);

create policy "vehicles: own"
  on public.courier_vehicles for all
  using  (auth.uid() = courier_id)
  with check (auth.uid() = courier_id);


-- ── 4. DELIVERIES ───────────────────────────────────────────────────
create table if not exists public.deliveries (
  id             uuid        primary key default gen_random_uuid(),
  sender_id      uuid        not null references public.users(id),
  courier_id     uuid        references public.couriers(id),
  contract_id    text,                       -- Stellar escrow contract ID
  tx_hash        text,                       -- Stellar tx hash
  from_name      text        not null,       -- Adres metni (Üsküdar…)
  to_name        text        not null,
  from_coords    jsonb       not null,       -- [lat, lng]
  to_coords      jsonb       not null,
  amount_usdc    numeric(14,6) not null,
  dist_km        numeric(8,2),
  eta            text,
  status         text        not null default 'waiting'
                   check (status in ('waiting', 'accepted', 'delivered', 'refunded')),
  secret_hash    text,                       -- HTLC hash
  expiry_ledger  int,                        -- ExpiryGuardian kullanır
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.deliveries enable row level security;

-- Bekleyen teslimatları herkes okuyabilir (kurye eşleştirme)
create policy "deliveries: public read waiting"
  on public.deliveries for select
  using (status = 'waiting');

-- Gönderici + kurye kendi teslimatlarını okur
create policy "deliveries: participant read"
  on public.deliveries for select
  using (auth.uid() = sender_id or auth.uid() = courier_id);

-- Gönderici yeni teslimat oluşturur
create policy "deliveries: sender insert"
  on public.deliveries for insert
  with check (auth.uid() = sender_id);

-- Kurye durum güncelleyebilir
create policy "deliveries: courier update"
  on public.deliveries for update
  using (auth.uid() = sender_id or auth.uid() = courier_id);

-- updated_at otomatik güncelle
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();


-- ── 5. AGENT_LOGS ───────────────────────────────────────────────────
-- AgentLog interface'i birebir karşılıyor
create table if not exists public.agent_logs (
  id          bigint      generated always as identity primary key,
  ts          timestamptz not null default now(),
  agent       text        not null,          -- "FraudDetector", "ReputationScorer"…
  level       text        not null check (level in ('info', 'warn', 'action', 'error')),
  message     text        not null,
  delivery_id uuid        references public.deliveries(id)
);

alter table public.agent_logs enable row level security;

-- Authenticated kullanıcılar yazar (agent'lar tarayıcıda çalışır)
create policy "agent_logs: auth insert"
  on public.agent_logs for insert
  with check (auth.uid() is not null);

-- Okuma yok (UI logları in-memory log-store'dan okur)
create policy "agent_logs: no read"
  on public.agent_logs for select
  using (false);


-- ── 6. FRAUD_EVENTS ─────────────────────────────────────────────────
-- FraudDetector agent'ın tespit ettiği olaylar
create table if not exists public.fraud_events (
  id           uuid        primary key default gen_random_uuid(),
  contract_id  text        not null,
  delivery_id  uuid        references public.deliveries(id),
  type         text        not null default 'duplicate_ip',
  ips          jsonb,                        -- ["1.2.3.4", "5.6.7.8"]
  frozen       boolean     not null default true,
  detected_at  timestamptz not null default now()
);

alter table public.fraud_events enable row level security;

create policy "fraud_events: auth insert"
  on public.fraud_events for insert
  with check (auth.uid() is not null);

create policy "fraud_events: no read"
  on public.fraud_events for select
  using (false);


-- ── 7. INDEXES ──────────────────────────────────────────────────────
create index if not exists idx_deliveries_sender   on public.deliveries(sender_id);
create index if not exists idx_deliveries_courier  on public.deliveries(courier_id);
create index if not exists idx_deliveries_status   on public.deliveries(status);
create index if not exists idx_agent_logs_agent    on public.agent_logs(agent);
create index if not exists idx_agent_logs_ts       on public.agent_logs(ts desc);
create index if not exists idx_vehicles_courier    on public.courier_vehicles(courier_id);
create index if not exists idx_fraud_contract      on public.fraud_events(contract_id);
