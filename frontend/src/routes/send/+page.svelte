<script lang="ts">
  import { initializeDelivery }              from "$lib/escrow";
  import { generateSecret, hashSecretBytes } from "$lib/crypto";
  import RouteMap   from "$lib/components/RouteMap.svelte";
  import LoginGate  from "$lib/components/LoginGate.svelte";
  import CourierMap from "$lib/components/CourierMap.svelte";
  import { currentUser, walletAddress, walletKeyId, connectWallet } from "$lib/auth";
  import { haversineKm } from "$lib/store";
  import { get }    from "svelte/store";
  import { supabase } from "$lib/supabase";
  import { t }      from "$lib/i18n";

  type Step = "route" | "courier" | "sending" | "done";

  // ── 50 kurye: bölge yoğunluğuna göre dağıtılmış ────────────────
  // 🔴 Kırmızı (yoğun): Kadıköy×6 + Üsküdar×6 = 12
  // 🟡 Sarı (orta):     Beşiktaş×4 + Sarıyer×4  = 8
  // 🟢 Yeşil (sakin):   Fatih×2    + Maltepe×2   = 4
  // Diğer alanlar: 26
  const BASE_COURIERS = [
    // 🔴 Kadıköy — 6 motor
    { id:"c01", name:"Ahmet Y.",   lat:41.0125, lng:28.9765, vehicle:"moto", pricePerKm:8.5, rating:4.8 },
    { id:"c02", name:"Fatma K.",   lat:41.0162, lng:28.9832, vehicle:"moto", pricePerKm:8.0, rating:4.5 },
    { id:"c03", name:"Mehmet D.",  lat:41.0092, lng:28.9758, vehicle:"moto", pricePerKm:9.0, rating:4.7 },
    { id:"c04", name:"Zeynep Ş.", lat:41.0148, lng:28.9848, vehicle:"moto", pricePerKm:7.5, rating:4.3 },
    { id:"c05", name:"Ali Ç.",     lat:41.0112, lng:28.9715, vehicle:"moto", pricePerKm:8.5, rating:4.6 },
    { id:"c06", name:"Ayşe Y.",    lat:41.0182, lng:28.9798, vehicle:"moto", pricePerKm:8.0, rating:4.9 },
    // 🔴 Üsküdar — 5 motor + 1 araba
    { id:"c07", name:"Mustafa D.", lat:41.0395, lng:29.0112, vehicle:"moto", pricePerKm:8.5, rating:4.4 },
    { id:"c08", name:"Elif Ö.",    lat:41.0445, lng:29.0072, vehicle:"moto", pricePerKm:9.0, rating:4.9 },
    { id:"c09", name:"Emre A.",    lat:41.0415, lng:29.0148, vehicle:"moto", pricePerKm:8.0, rating:4.6 },
    { id:"c10", name:"Merve P.",   lat:41.0372, lng:29.0085, vehicle:"moto", pricePerKm:7.5, rating:4.7 },
    { id:"c11", name:"Burak T.",   lat:41.0458, lng:29.0055, vehicle:"moto", pricePerKm:9.5, rating:4.3 },
    { id:"c12", name:"Murat Y.",   lat:41.0428, lng:29.0165, vehicle:"car",  pricePerKm:12.0, rating:4.9 },
    // 🟡 Beşiktaş — 3 motor + 1 araba
    { id:"c13", name:"Selin K.",   lat:41.0322, lng:28.9742, vehicle:"moto", pricePerKm:8.5, rating:4.6 },
    { id:"c14", name:"Serkan B.",  lat:41.0368, lng:28.9798, vehicle:"moto", pricePerKm:8.0, rating:4.1 },
    { id:"c15", name:"Derya M.",   lat:41.0342, lng:28.9715, vehicle:"moto", pricePerKm:8.5, rating:4.8 },
    { id:"c16", name:"Hatice D.",  lat:41.0388, lng:28.9768, vehicle:"car",  pricePerKm:11.5, rating:4.6 },
    // 🟡 Sarıyer — 3 motor + 1 araba
    { id:"c17", name:"Caner E.",   lat:41.0605, lng:29.0038, vehicle:"moto", pricePerKm:7.5, rating:4.5 },
    { id:"c18", name:"Tuğba S.",   lat:41.0648, lng:28.9985, vehicle:"moto", pricePerKm:9.0, rating:4.7 },
    { id:"c19", name:"Onur R.",    lat:41.0622, lng:29.0065, vehicle:"moto", pricePerKm:8.0, rating:4.2 },
    { id:"c20", name:"Kemal Ö.",   lat:41.0668, lng:29.0022, vehicle:"car",  pricePerKm:13.0, rating:4.7 },
    // 🟢 Fatih — 2 motor
    { id:"c21", name:"Büşra L.",   lat:41.0055, lng:28.9535, vehicle:"moto", pricePerKm:7.5, rating:4.9 },
    { id:"c22", name:"Arda N.",    lat:41.0105, lng:28.9582, vehicle:"moto", pricePerKm:8.0, rating:4.4 },
    // 🟢 Maltepe — 2 motor
    { id:"c23", name:"Özlem F.",   lat:40.9822, lng:29.0305, vehicle:"moto", pricePerKm:8.5, rating:4.6 },
    { id:"c24", name:"Hasan G.",   lat:40.9875, lng:29.0358, vehicle:"moto", pricePerKm:7.5, rating:4.3 },
    // ── Diğer bölgeler (26) ────────────────────────────────────────
    // Şişli (3)
    { id:"c25", name:"İrem C.",    lat:41.0588, lng:28.9862, vehicle:"moto", pricePerKm:8.5, rating:4.3 },
    { id:"c26", name:"Enes B.",    lat:41.0625, lng:28.9895, vehicle:"moto", pricePerKm:9.0, rating:4.6 },
    { id:"c27", name:"Pınar A.",   lat:41.0648, lng:28.9912, vehicle:"car",  pricePerKm:12.5, rating:4.5 },
    // Bakırköy (3)
    { id:"c28", name:"Ceyda O.",   lat:40.9812, lng:28.8725, vehicle:"moto", pricePerKm:7.5, rating:4.4 },
    { id:"c29", name:"Barış K.",   lat:40.9845, lng:28.8758, vehicle:"moto", pricePerKm:8.0, rating:4.7 },
    { id:"c30", name:"Osman E.",   lat:40.9795, lng:28.8705, vehicle:"car",  pricePerKm:11.0, rating:4.8 },
    // Ataşehir (3)
    { id:"c31", name:"Lale Y.",    lat:40.9895, lng:29.1168, vehicle:"moto", pricePerKm:8.5, rating:4.2 },
    { id:"c32", name:"Furkan Ş.", lat:40.9925, lng:29.1205, vehicle:"moto", pricePerKm:9.0, rating:4.9 },
    { id:"c33", name:"Sibel Ç.",   lat:40.9868, lng:29.1142, vehicle:"car",  pricePerKm:14.0, rating:4.6 },
    // Pendik (3)
    { id:"c34", name:"Azra D.",    lat:40.8758, lng:29.2295, vehicle:"moto", pricePerKm:7.5, rating:4.3 },
    { id:"c35", name:"Tolga M.",   lat:40.8792, lng:29.2335, vehicle:"moto", pricePerKm:8.0, rating:4.7 },
    { id:"c36", name:"Berkay P.",  lat:40.8772, lng:29.2312, vehicle:"car",  pricePerKm:12.0, rating:4.9 },
    // Kartal (3)
    { id:"c37", name:"Berna C.",   lat:40.9078, lng:29.1888, vehicle:"moto", pricePerKm:8.5, rating:4.5 },
    { id:"c38", name:"Kadir A.",   lat:40.9112, lng:29.1925, vehicle:"moto", pricePerKm:7.5, rating:4.1 },
    { id:"c39", name:"Selçuk G.",  lat:40.9092, lng:29.1908, vehicle:"car",  pricePerKm:13.5, rating:4.4 },
    // Bağcılar (3)
    { id:"c40", name:"Aslı R.",    lat:41.0382, lng:28.8548, vehicle:"moto", pricePerKm:9.0, rating:4.8 },
    { id:"c41", name:"Gökhan İ.", lat:41.0412, lng:28.8575, vehicle:"moto", pricePerKm:8.0, rating:4.1 },
    { id:"c42", name:"Didem K.",   lat:41.0398, lng:28.8562, vehicle:"moto", pricePerKm:8.5, rating:4.8 },
    // Gaziosmanpaşa (2)
    { id:"c43", name:"Nuray E.",   lat:41.0658, lng:28.9108, vehicle:"moto", pricePerKm:8.5, rating:4.6 },
    { id:"c44", name:"Cem B.",     lat:41.0688, lng:28.9142, vehicle:"moto", pricePerKm:7.5, rating:4.4 },
    // Kağıthane (2)
    { id:"c45", name:"Gülay T.",   lat:41.0822, lng:28.9818, vehicle:"moto", pricePerKm:9.0, rating:4.7 },
    { id:"c46", name:"Taner Ö.",   lat:41.0855, lng:28.9852, vehicle:"car",  pricePerKm:12.0, rating:4.8 },
    // Avcılar (2)
    { id:"c47", name:"Hakan K.",   lat:40.9792, lng:28.7215, vehicle:"moto", pricePerKm:7.5, rating:4.2 },
    { id:"c48", name:"Arzu M.",    lat:40.9815, lng:28.7242, vehicle:"moto", pricePerKm:8.5, rating:4.8 },
    // Küçükçekmece (2)
    { id:"c49", name:"Volkan T.",  lat:40.9788, lng:28.7782, vehicle:"moto", pricePerKm:8.0, rating:4.3 },
    { id:"c50", name:"Kübra H.",   lat:40.9822, lng:28.7815, vehicle:"car",  pricePerKm:11.5, rating:4.7 },
  ] as const;

  let step           = $state<Step>("route");
  let error          = $state("");
  let origin         = $state<[number,number] | null>(null);
  let dest           = $state<[number,number] | null>(null);
  let myLoc          = $state<[number,number] | null>(null);
  let locLoading     = $state(false);
  let amount         = $state("10");
  let selId          = $state("");
  let receiveLink    = $state("");
  let phone          = $state("");
  let smsSent        = $state(false);
  let txHash         = $state("");
  let demand         = $state(2.3);
  let dbCouriers     = $state<{ id:string; name:string; lat:number; lng:number; vehicle:string; pricePerKm:number; rating:number; stellarAddress:string; price:string; eta:string }[]>([]);
  let couriersLoading = $state(false);

  // Demand fluctuates
  $effect(() => {
    const t = setInterval(() => {
      demand = Math.round((1.5 + Math.random() * 3) * 10) / 10;
    }, 5000);
    return () => clearInterval(t);
  });

  function surgeMultiplier(d: number) { return d > 3 ? 1.4 : d > 2 ? 1.2 : 1.0; }
  function etaStr(km: number): string { return `${Math.max(1, Math.round(km / 25 * 60))} dk`; }

  function fetchCouriers() {
    const totalKm = (origin && dest) ? haversineKm(origin, dest) : 5;
    dbCouriers = BASE_COURIERS.map(c => {
      const toOriginKm = origin ? haversineKm([c.lat, c.lng], origin) : Math.random() * 3 + 0.5;
      return {
        ...c,
        stellarAddress: "",
        price: (c.pricePerKm * totalKm * surgeMultiplier(demand)).toFixed(2),
        eta:   etaStr(toOriginKm),
      };
    }).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }

  const selected = $derived(dbCouriers.find(c => c.id === selId) ?? null);

  const STEP_KEYS = ["send.step.route", "send.step.courier", "send.step.done"];
  function stepIdx(): number { return { route:0, courier:1, sending:1, done:2 }[step]; }

  function onRoute(o: [number,number], d: [number,number]) { origin = o; dest = d; }

  function useMyLocation() {
    if (!navigator.geolocation) { error = "Tarayıcı konum desteklemiyor."; return; }
    locLoading = true; error = "";
    navigator.geolocation.getCurrentPosition(
      pos => { myLoc = [pos.coords.latitude, pos.coords.longitude]; origin = myLoc; locLoading = false; },
      ()  => { error = $t("err.noLoc"); locLoading = false; },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function onRouteContinue() {
    if (!origin || !dest) { error = $t("err.noRoute"); return; }
    error = ""; step = "courier";
    fetchCouriers();
  }

  async function onConfirm() {
    if (!selected) return;
    step = "sending"; error = "";

    // Cüzdan yüklenmemişse otomatik bağlamayı dene
    let senderAddr = $walletAddress;
    let senderKey  = $walletKeyId;
    if (!senderAddr || !senderKey) {
      try { await connectWallet(); } catch {}
      senderAddr = $walletAddress;
      senderKey  = $walletKeyId;
    }

    const secret     = generateSecret();
    const secretHash = await hashSecretBytes(secret);
    receiveLink      = `${location.origin}/receive?secret=${encodeURIComponent(secret)}`;

    // Zincir üstü escrow — başarısız olsa bile akışı durdurma
    if (senderAddr && senderKey) {
      try {
        const courierAddr = selected.stellarAddress || senderAddr;
        const tx = await initializeDelivery({
          sender: senderAddr, courier: courierAddr,
          amountUsdc: BigInt(Math.round(parseFloat(amount) * 1_000_000)),
          secretHash, keyId: senderKey,
        });
        txHash = (tx as any).hash ?? "";
      } catch (e) {
        console.warn("Escrow tx atlandı:", e);
      }
    }

    // DB kaydı — her durumda
    const uid = get(currentUser)?.id;
    if (uid && origin && dest) {
      supabase.from("deliveries").insert({
        sender_id:   uid,
        courier_id:  selected.id,
        from_name:   `${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}`,
        to_name:     `${dest[0].toFixed(4)}, ${dest[1].toFixed(4)}`,
        from_coords: origin,
        to_coords:   dest,
        amount_usdc: parseFloat(amount),
        dist_km:     (origin && dest) ? +haversineKm(origin, dest).toFixed(2) : null,
        status:      "waiting",
        secret_hash: Array.from(secretHash).map(b => b.toString(16).padStart(2,"0")).join(""),
        tx_hash:     txHash || null,
      }).then(undefined, () => {});
    }

    step = "done";
  }

  function onWA() {
    const t = encodeURIComponent(`📦 StellarCourier teslim linkin:\n${receiveLink}`);
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${t}`, "_blank");
    smsSent = true;
  }

  const showMap = $derived(step === "route" || step === "courier");
</script>

<svelte:head><title>{$t("send.title")}</title></svelte:head>

<LoginGate>

<div class="page" class:with-map={showMap}>

  <!-- FORM COLUMN -->
  <div class="form-col">

    <!-- Stepbar -->
    <div class="stepbar">
      {#each STEP_KEYS as key, i}
        <div class="sb" class:active={i === stepIdx()} class:done={i < stepIdx()}>
          <div class="sb-dot"></div>
          <span>{$t(key)}</span>
        </div>
        {#if i < STEP_KEYS.length-1}<div class="sb-line" class:filled={i < stepIdx()}></div>{/if}
      {/each}
    </div>

    <div class="body">

      {#if step === "route"}
        <h2>{$t("send.route.h")}</h2>
        <p class="sub">Haritada <b>A</b> {$t("send.route.sub")}</p>

        <button class="btn-location w" onclick={useMyLocation} disabled={locLoading}>
          {#if locLoading}
            <span class="loc-spin"></span> {$t("send.route.locLoading")}
          {:else}
            📍 {$t("send.route.locBtn")}
          {/if}
        </button>

        <div class="field">
          <label>{$t("send.route.amount")}</label>
          <div class="inp-wrap">
            <input type="number" bind:value={amount} min="1" max="1000" step="0.5" />
            <span class="suffix">USDC</span>
          </div>
        </div>
        <div class="route-status">
          <div class="rs" class:set={!!origin}>
            <span class="pin-sm blue">A</span>
            {origin ? (myLoc && origin[0] === myLoc[0] ? $t("send.route.aGps") : $t("send.route.aSet")) : $t("send.route.aEmpty")}
          </div>
          <div class="rs" class:set={!!dest}><span class="pin-sm green">B</span>{dest ? $t("send.route.bSet") : $t("send.route.bEmpty")}</div>
        </div>
        {#if error}<p class="err">{error}</p>{/if}
        <button class="btn-primary w" onclick={onRouteContinue} disabled={!origin || !dest}>
          {$t("send.route.next")}
        </button>

      {:else if step === "courier"}
        <div class="demand-bar">
          <span>{$t("send.courier.demand")}</span>
          <div class="demand-meter">
            <div class="dm-fill"
              style="width:{Math.min(demand/4*100,100)}%;
                background:{demand>2.5?'var(--danger)':demand>1.8?'var(--warning)':'var(--success)'}">
            </div>
          </div>
          <span class="dm-val" style="color:{demand>2.5?'var(--danger)':demand>1.8?'var(--warning)':'var(--success)'}">
            {demand}x {demand>2.5?"🔥":demand>1.8?"⚡":""}
          </span>
        </div>

        <div class="courier-list">
          {#each dbCouriers as c}
              <button class="cc" class:cc-sel={selId === c.id} onclick={() => selId = c.id}>
                <div class="cc-av">{c.name[0]}</div>
                <div class="cc-info">
                  <div class="cc-name">{c.name}</div>
                  <div class="cc-meta">⭐ {c.rating.toFixed(1)} · {c.eta} · {c.vehicle === "moto" ? "🏍️" : "🚗"}</div>
                </div>
                <div class="cc-right">
                  <div class="cc-price">{c.price} USDC</div>
                  {#if demand > 2}<div class="surge-tag">⚡ Yoğun</div>{/if}
                </div>
              </button>
            {/each}
        </div>

        {#if error}<p class="err">{error}</p>{/if}
        <button class="btn-primary w" onclick={onConfirm} disabled={!selId}>
          {selId ? `${selected?.name} ${$t("send.courier.confirm")}` : $t("send.courier.select")}
        </button>

      {:else if step === "sending"}
        <div class="centered">
          <div class="spinner"></div>
          <p>{$t("send.sending")}</p>
        </div>

      {:else if step === "done"}
        <div class="done-icon">✓</div>
        <h2>{$t("send.done.h")}</h2>
        {#if txHash}
          <a href="https://stellar.expert/explorer/testnet/tx/{txHash}" target="_blank" class="tx-link">
            {txHash.slice(0,22)}… ↗
          </a>
        {/if}
        <div class="link-box">
          <div class="lb-top">
            <span class="lb-label">{$t("send.done.link")}</span>
            <button onclick={() => navigator.clipboard.writeText(receiveLink)}>{$t("send.done.copy")}</button>
          </div>
          <div class="lb-val">{receiveLink}</div>
        </div>
        <div class="wa-row">
          <input type="tel" placeholder="+905XXXXXXXXX" bind:value={phone} />
          <button class={smsSent?"":"btn-success"} onclick={onWA} disabled={!phone||smsSent}>
            {smsSent ? $t("send.done.sent") : $t("send.done.wa")}
          </button>
        </div>
        <button class="w" onclick={() => { step="route"; receiveLink=""; smsSent=false; txHash=""; origin=null; dest=null; selId=""; }}>
          {$t("send.done.new")}
        </button>
      {/if}

    </div>
  </div>

  <!-- MAP COLUMN -->
  {#if step === "route"}
    <div class="map-col">
      <RouteMap onRoute={onRoute} forcedOrigin={myLoc} />
    </div>
  {:else if step === "courier"}
    <div class="map-col">
      <CourierMap
        couriers={dbCouriers}
        selected={selId}
        onSelect={(id) => selId = id}
        origin={origin ?? undefined}
        dest={dest ?? undefined}
      />
    </div>
  {/if}

</div>

<style>
  .page { display:flex; height:100%; }

  .form-col {
    width: 340px; min-width: 340px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow-y: auto;
  }

  .page:not(.with-map) .form-col {
    width: 100%; border-right: none; align-items: center;
  }
  .page:not(.with-map) .stepbar,
  .page:not(.with-map) .body { max-width: 400px; width: 100%; }

  .map-col { flex: 1; }

  /* Stepbar */
  .stepbar {
    display: flex; align-items: center;
    padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); gap: 0;
  }
  .sb { display: flex; align-items: center; gap: .35rem; }
  .sb span { font-size: .75rem; color: var(--muted); font-weight: 500; }
  .sb.active span { color: var(--primary); font-weight: 600; }
  .sb.done   span { color: var(--success); }
  .sb-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--border); flex-shrink: 0;
  }
  .sb.active .sb-dot { background: var(--primary); }
  .sb.done   .sb-dot { background: var(--success); }
  .sb-line { flex: 1; height: 1px; background: var(--border); min-width: 16px; }
  .sb-line.filled { background: var(--success); }

  /* Body */
  .body { padding: 1.2rem; display: flex; flex-direction: column; gap: .8rem; flex: 1; }
  h2  { font-size: 1rem; font-weight: 700; }
  .sub{ font-size: .78rem; color: var(--muted); margin-top: -.3rem; line-height: 1.5; }

  .field { display: flex; flex-direction: column; gap: .3rem; }
  label  { font-size: .75rem; font-weight: 500; color: var(--muted); }
  .inp-wrap { position: relative; }
  .inp-wrap input { width: 100%; padding-right: 3.5rem; }
  .suffix {
    position: absolute; right: .7rem; top: 50%; transform: translateY(-50%);
    font-size: .78rem; color: var(--muted); font-weight: 600; pointer-events: none;
  }

  .route-status { display: flex; flex-direction: column; gap: .4rem; }
  .rs { display: flex; align-items: center; gap: .5rem; font-size: .8rem; color: var(--muted); }
  .rs.set { color: var(--text); }
  .pin-sm {
    width: 20px; height: 20px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .blue  { background: var(--primary); }
  .green { background: var(--success); }

  /* Demand bar */
  .demand-bar { display: flex; align-items: center; gap: .6rem; font-size: .78rem; color: var(--muted); }
  .demand-meter { flex: 1; height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .dm-fill { height: 100%; border-radius: 99px; transition: width .5s, background .5s; }
  .dm-val  { font-weight: 700; font-size: .8rem; white-space: nowrap; }

  /* Courier list */
  .courier-list { display: flex; flex-direction: column; gap: .35rem; overflow-y: auto; max-height: 340px; }
  .cc {
    display: flex; align-items: center; gap: .6rem;
    padding: .6rem .8rem;
    border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface); text-align: left; width: 100%; cursor: pointer;
    transition: border-color .12s, background .12s;
  }
  .cc:hover { border-color: var(--primary); background: #eff6ff; }
  .cc-sel   { border-color: var(--primary); background: #eff6ff; }

  .cc-av {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--primary); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: .82rem; font-weight: 700; flex-shrink: 0;
  }
  .cc-info { flex: 1; min-width: 0; }
  .cc-name { font-size: .82rem; font-weight: 600; }
  .cc-meta { font-size: .7rem; color: var(--muted); }
  .cc-right{ text-align: right; flex-shrink: 0; }
  .cc-price{ font-size: .85rem; font-weight: 700; color: var(--primary); }
  .surge-tag { font-size: .65rem; color: var(--warning); font-weight: 600; }

  .w   { width: 100%; padding: .55rem; }

  .btn-location {
    display: flex; align-items: center; justify-content: center; gap: .45rem;
    padding: .5rem; font-size: .82rem; font-weight: 500;
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: var(--radius); cursor: pointer; color: var(--primary);
    font-family: inherit; transition: background .12s;
  }
  .btn-location:hover:not(:disabled) { background: #dbeafe; }
  .btn-location:disabled { opacity: .6; cursor: default; }

  .loc-spin {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid #bfdbfe; border-top-color: var(--primary);
    animation: spin .7s linear infinite; flex-shrink: 0;
  }

  .empty-couriers { font-size:.8rem; color:var(--muted); text-align:center; padding:1.5rem .5rem; line-height:1.6; }
  .err { font-size: .78rem; color: var(--danger); background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius); padding: .5rem .7rem; }

  .centered { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2rem 0; }
  .spinner  {
    width: 26px; height: 26px; border: 2px solid var(--border);
    border-top-color: var(--primary); border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .done-icon {
    width: 40px; height: 40px; border-radius: 50%;
    background: #f0fdf4; border: 1px solid #bbf7d0;
    color: var(--success); display: flex; align-items: center;
    justify-content: center; font-size: 1.1rem; font-weight: 700;
  }
  .tx-link { font-family: monospace; font-size: .75rem; color: var(--primary); text-decoration: none; }

  .link-box {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: .8rem;
    display: flex; flex-direction: column; gap: .5rem;
  }
  .lb-top  { display: flex; justify-content: space-between; align-items: center; }
  .lb-label{ font-size: .68rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .lb-val  { font-size: .72rem; font-family: monospace; word-break: break-all; }

  .wa-row  { display: flex; gap: .5rem; }
  .wa-row input { flex: 1; }
</style>

</LoginGate>
