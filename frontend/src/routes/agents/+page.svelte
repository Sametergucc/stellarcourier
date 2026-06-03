<script lang="ts">
  import { onMount, onDestroy }        from "svelte";
  import { runner }                    from "$lib/agents/runner";
  import { logs }                      from "$lib/agents/log-store";
  import { analytics }                 from "$lib/agents/data/analytics-agent";
  import { connectWallet }             from "$lib/passkey";
  import { packages, courierProfile }  from "$lib/store";
  import type { Courier, Delivery }    from "$lib/agents/types";

  let running = $state(false);
  let wallet  = $state<{ keyId: string; address: string } | null>(null);

  // Build agent data from real store
  const mockCouriers: Courier[] = Array.from({ length: 8 }, (_, i) => ({
    address:          `GCOURIER${i}${"X".repeat(48)}`,
    rating:           3.2 + i * 0.24,
    location:         { lat: 41.01 + i * 0.03, lng: 28.97 + i * 0.03 },
    activeDeliveries: Math.floor(i / 2),
    basePricePerKm:   BigInt(Math.round((7 + i * 0.8) * 1_000_000)),
    suspended:        i === 7,
  }));

  const mockDeliveries: Delivery[] = $packages.map((pkg, i) => ({
    contractId:   `C${pkg.id.replace("-","")}${"A".repeat(50)}`.slice(0,56),
    sender:       `GSENDER${"0".repeat(49)}`,
    courier:      mockCouriers[i % mockCouriers.length].address,
    amount:       BigInt(Math.round(pkg.amount * 1_000_000)),
    expiryLedger: 600_000 + i * 1000,
    status:       pkg.status === "waiting" ? "Active" : pkg.status === "delivered" ? "Released" : "Active" as any,
    location:     { lat: pkg.fromCoords[0], lng: pkg.fromCoords[1] },
  }));

  async function onStart() {
    try { wallet = await connectWallet(); } catch {
      wallet = { keyId: "demo", address: "GDEMO" + "X".repeat(51) };
    }
    runner.setIdentity(wallet.keyId, wallet.address);
    runner.setData(mockCouriers, mockDeliveries);
    await runner.start();
    running = true;
  }

  function onStop() { runner.stop(); running = false; }
  onDestroy(() => runner.stop());

  const LEVEL_STYLE: Record<string, string> = {
    info:   "color:#64748b",
    warn:   "color:#f59e0b",
    action: "color:#3b82f6",
    error:  "color:#ef4444",
  };

  const AGENTS = [
    { name:"CourierAgent",    icon:"💰", desc:"Dinamik fiyatlama" },
    { name:"Dispatcher",      icon:"🎯", desc:"Kurye eşleştirme" },
    { name:"FraudDetector",   icon:"🛡️", desc:"Dolandırıcılık tespiti" },
    { name:"ExpiryGuardian",  icon:"⏰", desc:"Süre takibi" },
    { name:"GeoFence",        icon:"📍", desc:"Konum izleme" },
    { name:"AutoRefundBot",   icon:"↩️", desc:"Otomatik iade" },
    { name:"MultiHopRouter",  icon:"🔄", desc:"Token dönüşümü" },
    { name:"EventIndexer",    icon:"📡", desc:"Kontrat olayları" },
    { name:"Analytics",       icon:"📊", desc:"Metrik hesaplama" },
    { name:"ReputationScorer",icon:"⭐", desc:"Kurye puanlama" },
  ];
</script>

<svelte:head><title>StellarCourier — Ajanlar</title></svelte:head>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <h1>Otonom Ajan Dashboard</h1>
      <p class="sub">10 ajan, gerçek zamanlı blockchain orkestrasyonu</p>
    </div>
    {#if !running}
      <button class="btn-primary" onclick={onStart}>▶ Tüm Ajanları Başlat</button>
    {:else}
      <button class="btn-ghost" onclick={onStop}>⏹ Durdur</button>
    {/if}
  </div>

  <!-- Analytics strip -->
  {#if $analytics.lastUpdated}
    <div class="analytics-strip">
      <div class="an-card">
        <span class="an-label">Toplam Teslimat</span>
        <span class="an-value">{$analytics.totalDeliveries}</span>
      </div>
      <div class="an-card">
        <span class="an-label">Tamamlanan</span>
        <span class="an-value success">{$analytics.completed}</span>
      </div>
      <div class="an-card">
        <span class="an-label">İade</span>
        <span class="an-value warn">{$analytics.refunded}</span>
      </div>
      <div class="an-card">
        <span class="an-label">Başarı Oranı</span>
        <span class="an-value">{$analytics.successRate}%</span>
      </div>
      <div class="an-card">
        <span class="an-label">Ort. Tutar</span>
        <span class="an-value">${$analytics.avgAmountUsdc} USDC</span>
      </div>
      <div class="an-card">
        <span class="an-label">Aktif Kurye</span>
        <span class="an-value">{$analytics.avgActiveCouriers}</span>
      </div>
    </div>
  {/if}

  <div class="body">

    <!-- Agent cards -->
    <div class="agents-grid">
      {#each AGENTS as a}
        {@const hasLogs = $logs.some(l => l.agent === a.name)}
        <div class="agent-card" class:active={running && hasLogs}>
          <div class="agent-top">
            <span class="agent-icon">{a.icon}</span>
            <div class="agent-status">
              {#if running}
                <span class="dot {hasLogs ? 'dot-green' : 'dot-yellow'} pulse"></span>
              {:else}
                <span class="dot dot-gray"></span>
              {/if}
            </div>
          </div>
          <div class="agent-name">{a.name}</div>
          <div class="agent-desc">{a.desc}</div>
          {#if running && hasLogs}
            {@const last = $logs.find(l => l.agent === a.name)}
            {#if last}
              <div class="agent-last" style={LEVEL_STYLE[last.level]}>
                {last.message.slice(0, 52)}…
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>

    <!-- Live log -->
    <div class="log-panel">
      <div class="log-header">
        <span>Canlı Log</span>
        <span class="log-count">{$logs.length} kayıt</span>
      </div>
      <div class="log-body">
        {#each $logs as entry (entry.ts + entry.message)}
          <div class="log-row">
            <span class="log-ts">{new Date(entry.ts).toLocaleTimeString("tr")}</span>
            <span class="log-level" style={LEVEL_STYLE[entry.level]}>{entry.level.toUpperCase()}</span>
            <span class="log-agent">{entry.agent}</span>
            <span class="log-msg">{entry.message}</span>
          </div>
        {:else}
          <div class="log-empty">Ajan başlatılmadı — yukarıdan başlat</div>
        {/each}
      </div>
    </div>

  </div>
</div>

<style>
  .page  { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem; height: 100vh; overflow: auto; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  h1  { font-size: 1.4rem; font-weight: 700; margin-bottom: .2rem; }
  .sub{ color: var(--muted); font-size: .85rem; }

  /* Analytics */
  .analytics-strip { display: flex; gap: .7rem; flex-wrap: wrap; }
  .an-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .75rem 1rem;
    display: flex; flex-direction: column; gap: .2rem;
    min-width: 110px;
  }
  .an-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .an-value { font-size: 1.3rem; font-weight: 700; }
  .an-value.success { color: var(--success); }
  .an-value.warn    { color: var(--warning); }

  /* Body */
  .body { display: grid; grid-template-columns: 1fr 380px; gap: 1rem; flex: 1; min-height: 0; }

  /* Agent cards */
  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: .7rem;
    align-content: start;
  }
  .agent-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    display: flex; flex-direction: column; gap: .3rem;
    transition: border-color .2s, background .2s;
  }
  .agent-card.active { border-color: #3b82f640; background: #3b82f606; }

  .agent-top  { display: flex; justify-content: space-between; align-items: center; margin-bottom: .3rem; }
  .agent-icon { font-size: 1.4rem; }
  .agent-name { font-size: .9rem; font-weight: 600; }
  .agent-desc { font-size: .75rem; color: var(--muted); }
  .agent-last { font-size: .7rem; margin-top: .3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .dot        { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-green  { background: var(--success); }
  .dot-yellow { background: var(--warning); }
  .dot-gray   { background: var(--muted); }

  /* Log panel */
  .log-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .log-header {
    padding: .75rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-size: .8rem; font-weight: 600;
  }
  .log-count { color: var(--muted); font-weight: 400; }
  .log-body  { flex: 1; overflow-y: auto; padding: .5rem; display: flex; flex-direction: column; gap: .15rem; }

  .log-row   { display: grid; grid-template-columns: 70px 54px 110px 1fr;
               gap: .4rem; font-size: .72rem; padding: .2rem .3rem; border-radius: 4px; }
  .log-row:hover { background: var(--surface2); }
  .log-ts    { color: var(--muted); }
  .log-level { font-weight: 700; }
  .log-agent { color: var(--primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
  .log-msg   { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-empty { color: var(--muted); font-size: .8rem; padding: 2rem; text-align: center; }
</style>
