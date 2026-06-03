<script lang="ts">
  import { onMount }          from "svelte";
  import { releaseDelivery }  from "$lib/escrow";
  import { encodeSecret }     from "$lib/crypto";
  import QrScanner            from "$lib/components/QrScanner.svelte";
  import LiveMap              from "$lib/components/LiveMap.svelte";
  import LoginGate            from "$lib/components/LoginGate.svelte";
  import { currentUser, walletAddress, walletKeyId, connectWallet } from "$lib/auth";
  import { t } from "$lib/i18n";
  import {
    courierProfile, packages, activeDelivery, myLocation,
    waitingPackages, acceptPackage, deliverPackage, startLocationTracking,
    loadCourierProfile, saveCourierProfile, loadDeliveries, subscribeDeliveries,
    type Vehicle, type Package,
  } from "$lib/store";

  type Step = "vehicle" | "pricing" | "dashboard" | "scan" | "done";

  let step       = $state<Step>("vehicle");
  // wallet from auth store
  const wallet = $derived(
    $currentUser && $walletAddress
      ? { keyId: $walletKeyId, address: $walletAddress }
      : null
  );
  let error      = $state("");
  let txHash     = $state("");
  let scanSecret = $state("");
  let locGranted = $state(false);
  let connecting = $state(false);

  async function onConnectWallet() {
    connecting = true; error = "";
    try {
      const ok = await connectWallet();
      if (!ok) error = $t("wallet.failed");
    } catch (e: any) {
      error = e?.message ?? $t("wallet.failed");
    } finally {
      connecting = false;
    }
  }

  // Registration state
  let selVehicle = $state<Vehicle | null>(null);
  let pricePerKm = $state(9.5);
  let driverName = $state("");
  let plate      = $state("");

  // Average prices by vehicle
  const AVG_PRICES: Record<Vehicle, number> = { moto: 8.5, car: 12.0, commercial: 18.0 };
  const VEHICLES: { key: Vehicle; icon: string; labelKey: string; descKey: string }[] = [
    { key: "moto",       icon: "🏍️", labelKey: "courier.v.moto", descKey: "courier.v.motoD" },
    { key: "car",        icon: "🚗", labelKey: "courier.v.car",  descKey: "courier.v.carD"  },
    { key: "commercial", icon: "🚐", labelKey: "courier.v.comm", descKey: "courier.v.commD" },
  ];

  const COMMISSION = 0.07;
  const TRUST_SCORE = 75;

  // Load saved profile from DB + realtime
  onMount(async () => {
    const uid     = $currentUser?.id;
    const stellar = $walletAddress;
    if (uid && stellar) await loadCourierProfile(uid, stellar);
    await loadDeliveries();

    const p = $courierProfile;
    if (p) {
      selVehicle = p.vehicle;
      pricePerKm = p.pricePerKm;
      driverName = p.name;
      requestLocation();
      step = "dashboard";
    }

    const unsub = subscribeDeliveries();
    return () => unsub();
  });

  function requestLocation() {
    startLocationTracking();
    navigator.geolocation?.getCurrentPosition(
      pos => { myLocation.set([pos.coords.latitude, pos.coords.longitude]); locGranted = true; },
      _   => { locGranted = false; }
    );
  }

  function onVehicleNext() {
    if (!selVehicle) return;
    pricePerKm = AVG_PRICES[selVehicle];
    step = "pricing";
  }

  async function onPricingDone() {
    if (!selVehicle || !$currentUser) return;
    const addr = $walletAddress || wallet?.address || "";
    const profile = {
      address: addr, name: driverName || "Kurye",
      vehicle: selVehicle, pricePerKm,
      trustScore: TRUST_SCORE, commission: COMMISSION,
      location: null, active: true, earnings: 0, deliveries: 0,
    };
    courierProfile.set(profile);
    saveCourierProfile($currentUser.id, profile, plate || undefined).catch(() => {});
    requestLocation();
    step = "dashboard";
  }

  async function onAccept(pkg: Package) {
    let w = wallet;
    if (!w) { try { await connectWallet(); } catch {} w = wallet; }
    acceptPackage(pkg, w?.address ?? "", $currentUser?.id);
  }

  async function onRelease() {
    if (!$activeDelivery) return;
    error = "";

    // Cüzdan yoksa otomatik bağla
    let w = wallet;
    if (!w) { try { await connectWallet(); } catch {} w = wallet; }

    // Zincir üstü release — başarısız olsa bile teslimatı tamamla
    if (w) {
      try {
        await releaseDelivery({
          courier: w.address,
          secret:  encodeSecret(scanSecret),
          keyId:   w.keyId,
        });
      } catch (e) {
        console.warn("Release tx atlandı:", e);
      }
    }

    deliverPackage($activeDelivery.id, $currentUser?.id);
    step = "done";
  }

  const cp = $derived($courierProfile);
  const netEarnings = $derived(cp ? cp.earnings * (1 - COMMISSION) : 0);
</script>

<svelte:head><title>{$t("courier.title")}</title></svelte:head>

<LoginGate>

<!-- ═══════════════════════ VEHICLE ═══════════════════════ -->
{#if step === "vehicle"}
<div class="center-page">
  <div class="card wide">
    <h2>{$t("courier.v.h")}</h2>
    <p class="sub">{$t("courier.v.sub")}</p>
    <div class="vehicle-grid">
      {#each VEHICLES as v}
        <button
          class="vcard"
          class:vcard-sel={selVehicle === v.key}
          onclick={() => selVehicle = v.key}
        >
          <span class="v-icon">{v.icon}</span>
          <span class="v-label">{$t(v.labelKey)}</span>
          <span class="v-desc">{$t(v.descKey)}</span>
          <span class="v-price">~{AVG_PRICES[v.key]} USDC/km</span>
        </button>
      {/each}
    </div>
    <button class="btn-primary w" onclick={onVehicleNext} disabled={!selVehicle}>
      {$t("courier.v.next")}
    </button>
  </div>
</div>

<!-- ═══════════════════════ PRICING ═══════════════════════ -->
{:else if step === "pricing"}
<div class="center-page">
  <div class="card">
    <h2>{$t("courier.p.h")}</h2>
    <div class="avg-hint">
      <span class="avg-icon">📍</span>
      <div>
        <div class="avg-title">{$t("courier.p.avg")}</div>
        <div class="avg-val">{AVG_PRICES[selVehicle!]} USDC/km</div>
      </div>
    </div>

    <div class="field">
      <label>{$t("courier.p.name")}</label>
      <input bind:value={driverName} placeholder={$t("courier.p.namePh")} />
    </div>

    <div class="field">
      <label>{$t("courier.p.plate")}</label>
      <input bind:value={plate} placeholder="34 ABC 123" style="text-transform:uppercase" />
    </div>

    <div class="field">
      <label>{$t("courier.p.rate")}</label>
      <div class="slider-wrap">
        <input type="range" bind:value={pricePerKm}
          min={AVG_PRICES[selVehicle!] * 0.6}
          max={AVG_PRICES[selVehicle!] * 1.8}
          step="0.5" />
        <div class="slider-labels">
          <span>{$t("courier.p.low")}</span>
          <b class="slider-val">{pricePerKm.toFixed(1)} USDC/km</b>
          <span>{$t("courier.p.high")}</span>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">{$t("courier.p.trust")}</span>
        <div class="trust-bar">
          <div class="trust-fill" style="width:{TRUST_SCORE}%"></div>
        </div>
        <span class="info-val">{TRUST_SCORE}/100</span>
      </div>
      <div class="info-item">
        <span class="info-label">{$t("courier.p.comm")}</span>
        <span class="info-val comm">%{Math.round(COMMISSION * 100)}</span>
      </div>
    </div>

    <button class="btn-primary w" onclick={onPricingDone}>{$t("courier.p.next")}</button>
  </div>
</div>

<!-- ═══════════════════════ DASHBOARD ═══════════════════════ -->
{:else if step === "dashboard"}
<div class="dash">

  <!-- Left panel -->
  <div class="dash-panel">

    <!-- Profile bar -->
    <div class="profile-bar">
      <div class="p-avatar">{cp?.vehicle === "moto" ? "🏍️" : cp?.vehicle === "car" ? "🚗" : "🚐"}</div>
      <div class="p-info">
        <div class="p-name">{cp?.name || "Kurye"}</div>
        <div class="p-addr">{wallet ? wallet.address.slice(0,10) + "…" : "—"}</div>
      </div>
      <div class="p-stats">
        <div class="p-stat">
          <div class="p-num">{cp?.earnings.toFixed(2)}</div>
          <div class="p-lbl">{$t("courier.d.gross")}</div>
        </div>
        <div class="p-stat">
          <div class="p-num green">{netEarnings.toFixed(2)}</div>
          <div class="p-lbl">{$t("courier.d.net")}</div>
        </div>
      </div>
    </div>

    <!-- Wallet bağlama banner'ı (cüzdan yüklenmemişse) -->
    {#if !wallet}
      <div class="wallet-banner">
        <span class="wb-text">⚠ {$t("wallet.notReady")}</span>
        <button class="wb-btn" onclick={onConnectWallet} disabled={connecting}>
          {#if connecting}
            <span class="loc-spin"></span> {$t("wallet.connecting")}
          {:else}
            🔗 {$t("wallet.connect")}
          {/if}
        </button>
      </div>
    {/if}

    <!-- Trust + commission -->
    <div class="meta-bar">
      <div class="meta-item">
        <span class="meta-label">{$t("courier.d.trust")}</span>
        <div class="trust-row">
          <div class="trust-mini">
            <div class="trust-mini-fill" style="width:{TRUST_SCORE}%"></div>
          </div>
          <span class="trust-num">{TRUST_SCORE}/100</span>
        </div>
      </div>
      <div class="meta-sep"></div>
      <div class="meta-item">
        <span class="meta-label">{$t("courier.d.comm")}</span>
        <span class="meta-val">%{Math.round(COMMISSION * 100)}</span>
      </div>
      <div class="meta-sep"></div>
      <div class="meta-item">
        <span class="meta-label">{$t("courier.d.loc")}</span>
        <span class="meta-val" class:green={locGranted}>{locGranted ? $t("courier.d.locOn") : "—"}</span>
      </div>
    </div>

    <!-- Active delivery -->
    {#if $activeDelivery}
      <div class="active-section">
        <div class="section-label">{$t("courier.d.active")}</div>
        <div class="active-card">
          <div class="ac-route">
            <span class="pin-a">A</span>{$activeDelivery.from}
            <span class="arrow">→</span>
            <span class="pin-b">B</span>{$activeDelivery.to}
          </div>
          <div class="ac-meta">{$activeDelivery.distKm} km · {$activeDelivery.eta} · <b>{$activeDelivery.amount} USDC</b></div>
          <button class="btn-primary w" onclick={() => step = "scan"}>
            {$t("courier.d.scan")}
          </button>
        </div>
      </div>
    {/if}

    <!-- Available packages -->
    <div class="section-label">
      {$t("courier.d.nearby")}
      <span class="badge badge-blue">{$waitingPackages.length}</span>
    </div>
    <div class="pkg-list">
      {#each $waitingPackages as pkg}
        <div class="pkg-card">
          <div class="pkg-top">
            <span class="pkg-id">{pkg.id}</span>
            <span class="pkg-price">{pkg.amount} USDC</span>
          </div>
          <div class="pkg-route">{pkg.from} → {pkg.to}</div>
          <div class="pkg-meta">{pkg.distKm} km · {pkg.eta}</div>
          <button
            class="btn-primary sm w"
            onclick={() => onAccept(pkg)}
            disabled={!!$activeDelivery}
          >
            {$t("courier.d.accept")}
          </button>
        </div>
      {:else}
        <p class="empty">{$t("courier.d.empty")}</p>
      {/each}
    </div>

  </div>

  <!-- Map -->
  <div class="dash-map">
    {#if !locGranted}
      <div class="loc-prompt">
        <button class="btn-primary" onclick={requestLocation}>
          📍 Konumu Paylaş
        </button>
        <p>Harita ve paket eşleştirme için konum gerekli.</p>
      </div>
    {:else}
      <LiveMap
        myLocation={$myLocation}
        packages={$packages}
        activeDelivery={$activeDelivery}
        onSelect={onAccept}
      />
    {/if}
  </div>

</div>

<!-- ═══════════════════════ SCAN ═══════════════════════ -->
{:else if step === "scan"}
<div class="center-page">
  <div class="card">
    <h2>{$t("courier.s.h")}</h2>
    <p>{$t("courier.s.sub")}</p>
    <div class="scanner-wrap">
      <QrScanner onScan={(s) => scanSecret = s} onError={(m) => console.warn(m)} />
    </div>
    {#if scanSecret}
      <div class="scan-ok">{$t("courier.s.ok")}</div>
      <button class="btn-primary w" onclick={onRelease}>{$t("courier.s.release")}</button>
    {/if}
    {#if error}<p class="err">{error}</p>{/if}
    <button class="w" onclick={() => step = "dashboard"}>{$t("courier.s.back")}</button>
  </div>
</div>

<!-- ═══════════════════════ DONE ═══════════════════════ -->
{:else if step === "done"}
<div class="center-page">
  <div class="card">
    <div class="done-circle">✓</div>
    <h2>{$t("courier.done.h")}</h2>
    <p>{$t("courier.done.sub")}</p>
    {#if txHash}
      <a href="https://stellar.expert/explorer/testnet/tx/{txHash}" target="_blank" class="tx-link">
        {txHash.slice(0,22)}… ↗
      </a>
    {/if}
    <button class="btn-primary w" onclick={() => { step="dashboard"; scanSecret=""; }}>{$t("courier.done.back")}</button>
  </div>
</div>
{/if}

<style>
  /* ── Layout ── */
  .center-page { display:flex; align-items:center; justify-content:center; min-height:100%; padding:2rem; }
  .card        { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.75rem; display:flex; flex-direction:column; gap:.9rem; width:100%; max-width:380px; }
  .card.wide   { max-width:560px; }
  .card-icon   { font-size:2.2rem; text-align:center; }
  h2           { font-size:1.05rem; font-weight:700; }
  .sub         { font-size:.8rem; color:var(--muted); line-height:1.5; margin-top:-.3rem; }

  /* ── Vehicle grid ── */
  .vehicle-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; }
  .vcard {
    display:flex; flex-direction:column; align-items:center; gap:.35rem;
    padding:.9rem .5rem; border:1px solid var(--border); border-radius:var(--radius);
    background:var(--surface); cursor:pointer; text-align:center;
    transition:border-color .12s, background .12s;
  }
  .vcard:hover { border-color:var(--primary); background:#eff6ff; }
  .vcard-sel   { border-color:var(--primary); background:#eff6ff; }
  .v-icon  { font-size:1.8rem; }
  .v-label { font-size:.85rem; font-weight:700; }
  .v-desc  { font-size:.7rem; color:var(--muted); line-height:1.4; }
  .v-price { font-size:.72rem; font-weight:600; color:var(--primary); }

  /* ── Pricing ── */
  .avg-hint {
    display:flex; align-items:center; gap:.75rem;
    background:#eff6ff; border:1px solid #bfdbfe;
    border-radius:var(--radius); padding:.75rem;
  }
  .avg-icon  { font-size:1.5rem; }
  .avg-title { font-size:.75rem; color:var(--muted); }
  .avg-val   { font-size:1.1rem; font-weight:700; color:var(--primary); }

  .field { display:flex; flex-direction:column; gap:.35rem; }
  label  { font-size:.75rem; font-weight:500; color:var(--muted); }
  input[type="text"], input:not([type="range"]) { width:100%; }

  .slider-wrap  { display:flex; flex-direction:column; gap:.4rem; }
  input[type="range"] { width:100%; accent-color:var(--primary); }
  .slider-labels { display:flex; justify-content:space-between; align-items:center; font-size:.72rem; color:var(--muted); }
  .slider-val    { font-weight:700; color:var(--text); font-size:.85rem; }

  .info-grid { display:grid; grid-template-columns:1fr auto; gap:.75rem; align-items:start; }
  .info-item { display:flex; flex-direction:column; gap:.3rem; }
  .info-label{ font-size:.72rem; color:var(--muted); font-weight:500; }
  .info-val  { font-size:.9rem; font-weight:700; }
  .info-val.comm { color:var(--warning); }

  .trust-bar { height:5px; background:var(--border); border-radius:99px; overflow:hidden; }
  .trust-fill { height:100%; background:var(--success); border-radius:99px; }

  /* ── Wallet banner ── */
  .wallet-banner {
    display:flex; flex-direction:column; gap:.5rem;
    padding:.75rem 1rem;
    background:#fffbeb; border-bottom:1px solid #fde68a;
  }
  .wb-text { font-size:.78rem; color:#92400e; font-weight:500; }
  .wb-btn {
    display:flex; align-items:center; justify-content:center; gap:.45rem;
    padding:.5rem; font-size:.82rem; font-weight:600;
    background:var(--primary); color:#fff; border:none;
    border-radius:var(--radius); cursor:pointer; font-family:inherit;
    transition:opacity .12s;
  }
  .wb-btn:hover:not(:disabled) { opacity:.9; }
  .wb-btn:disabled { opacity:.6; cursor:default; }
  .loc-spin {
    width:13px; height:13px; border-radius:50%;
    border:2px solid #ffffff66; border-top-color:#fff;
    animation:spin .7s linear infinite; flex-shrink:0;
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* ── Dashboard ── */
  .dash      { display:flex; height:100%; }
  .dash-panel{
    width:300px; min-width:300px;
    background:var(--surface); border-right:1px solid var(--border);
    display:flex; flex-direction:column; overflow-y:auto;
  }
  .dash-map  { flex:1; position:relative; }

  .profile-bar {
    display:flex; align-items:center; gap:.7rem;
    padding:1rem; border-bottom:1px solid var(--border);
  }
  .p-avatar { font-size:1.8rem; flex-shrink:0; }
  .p-info   { flex:1; min-width:0; }
  .p-name   { font-size:.88rem; font-weight:600; }
  .p-addr   { font-size:.7rem; color:var(--muted); font-family:monospace; }
  .p-stats  { display:flex; gap:.6rem; flex-shrink:0; }
  .p-stat   { text-align:right; }
  .p-num    { font-size:.95rem; font-weight:700; }
  .p-num.green { color:var(--success); }
  .p-lbl    { font-size:.65rem; color:var(--muted); }

  .meta-bar {
    display:flex; align-items:center; gap:.75rem;
    padding:.65rem 1rem; border-bottom:1px solid var(--border);
    background:var(--bg);
  }
  .meta-item  { display:flex; flex-direction:column; gap:.2rem; flex:1; }
  .meta-label { font-size:.65rem; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  .meta-val   { font-size:.82rem; font-weight:700; }
  .meta-val.green { color:var(--success); }
  .meta-sep   { width:1px; height:28px; background:var(--border); }

  .trust-row  { display:flex; align-items:center; gap:.4rem; }
  .trust-mini { flex:1; height:4px; background:var(--border); border-radius:99px; overflow:hidden; }
  .trust-mini-fill { height:100%; background:var(--success); border-radius:99px; }
  .trust-num  { font-size:.72rem; font-weight:700; color:var(--success); white-space:nowrap; }

  .active-section { padding:.8rem 1rem; border-bottom:1px solid var(--border); }
  .active-card {
    background:#eff6ff; border:1px solid #bfdbfe;
    border-radius:var(--radius); padding:.85rem;
    display:flex; flex-direction:column; gap:.5rem; margin-top:.4rem;
  }
  .ac-route { display:flex; align-items:center; gap:.4rem; font-size:.85rem; font-weight:600; }
  .ac-meta  { font-size:.75rem; color:var(--muted); }
  .arrow    { color:var(--muted); }

  .pin-a, .pin-b {
    width:18px; height:18px; border-radius:50%;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:9px; font-weight:700; color:#fff; flex-shrink:0;
  }
  .pin-a { background:var(--primary); }
  .pin-b { background:var(--success); }

  .section-label {
    font-size:.72rem; font-weight:600;
    text-transform:uppercase; letter-spacing:.06em; color:var(--muted);
    padding:.75rem 1rem .35rem;
    display:flex; align-items:center; gap:.4rem;
  }

  .pkg-list { display:flex; flex-direction:column; gap:.4rem; padding:0 .8rem .8rem; overflow-y:auto; }
  .pkg-card {
    border:1px solid var(--border); border-radius:var(--radius);
    padding:.75rem; display:flex; flex-direction:column; gap:.3rem;
    background:var(--surface);
  }
  .pkg-top   { display:flex; justify-content:space-between; }
  .pkg-id    { font-family:monospace; font-size:.7rem; color:var(--muted); }
  .pkg-price { font-weight:700; color:var(--primary); font-size:.85rem; }
  .pkg-route { font-size:.82rem; font-weight:600; }
  .pkg-meta  { font-size:.72rem; color:var(--muted); }
  .empty     { font-size:.8rem; color:var(--muted); text-align:center; padding:1rem; }

  /* Scan */
  .scanner-wrap { border-radius:var(--radius); overflow:hidden; }
  .scan-ok { font-size:.82rem; color:var(--success); font-weight:600; text-align:center; }

  /* Location prompt */
  .loc-prompt {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:.75rem; height:100%; text-align:center; padding:2rem;
  }
  .loc-prompt p { font-size:.82rem; color:var(--muted); }

  /* Done */
  .done-circle {
    width:48px; height:48px; border-radius:50%;
    background:#f0fdf4; border:1px solid #bbf7d0;
    color:var(--success); display:flex; align-items:center; justify-content:center;
    font-size:1.3rem; font-weight:700; margin:0 auto;
  }
  .tx-link { font-family:monospace; font-size:.75rem; color:var(--primary); text-decoration:none; text-align:center; }

  /* Shared */
  .w    { width:100%; padding:.5rem; }
  .sm   { padding:.35rem .6rem; font-size:.78rem; }
  .green{ color:var(--success); }
  .err  { font-size:.78rem; color:var(--danger); background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius); padding:.5rem .7rem; }
</style>

</LoginGate>
