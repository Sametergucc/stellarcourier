<!-- Courier selection map: shows courier markers from DB + demand zones -->
<script lang="ts">
  export interface Courier {
    id: string; name: string; lat: number; lng: number;
    price: string; rating: number; eta: string;
  }

  interface Props {
    couriers:  Courier[];
    selected?: string;
    onSelect:  (id: string) => void;
    origin?:   [number,number];
    dest?:     [number,number];
  }
  const { couriers, selected, onSelect, origin, dest }: Props = $props();

  const ZONES = [
    { lat:41.015, lng:28.980, intensity:.92, label:"Kadıköy"  },
    { lat:41.035, lng:28.977, intensity:.75, label:"Beşiktaş" },
    { lat:41.008, lng:28.956, intensity:.55, label:"Fatih"    },
    { lat:41.042, lng:29.009, intensity:.83, label:"Üsküdar"  },
    { lat:41.063, lng:29.001, intensity:.61, label:"Sarıyer"  },
    { lat:40.985, lng:29.033, intensity:.47, label:"Maltepe"  },
  ] as const;

  function heatColor(i: number) {
    return i > .8 ? "#dc2626" : i > .6 ? "#d97706" : "#0f9960";
  }

  let mapEl: HTMLDivElement | undefined = $state();

  // Shared refs — mutated by init effect, read by markers effect
  let _L:       any     = null;
  let _map:     any     = null;
  let _ready          = $state(false);
  let _markers: any[] = [];

  // ── Effect 1: haritayı bir kez kur ──────────────────────────────
  $effect(() => {
    if (!mapEl) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl) return;

      _L   = L;
      _map = L.map(mapEl, { zoomControl: false }).setView(origin ?? [41.015, 28.980], 12);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO", maxZoom: 19,
      }).addTo(_map);
      L.control.zoom({ position: "bottomright" }).addTo(_map);

      // Origin / dest pinleri
      if (origin) L.marker(origin, { icon: L.divIcon({
        className:"", iconSize:[28,28], iconAnchor:[14,14],
        html:`<div class="pin pin-blue">A</div>`,
      })}).addTo(_map);

      if (dest) {
        L.marker(dest, { icon: L.divIcon({
          className:"", iconSize:[28,28], iconAnchor:[14,14],
          html:`<div class="pin pin-green">B</div>`,
        })}).addTo(_map);
        if (origin) L.polyline([origin, dest], {
          color:"#1a73e8", weight:2, dashArray:"6 4", opacity:.5,
        }).addTo(_map);
      }

      // Talep bölgeleri
      ZONES.forEach(z => {
        const c = heatColor(z.intensity);
        L.circle([z.lat, z.lng], {
          radius: z.intensity * 1600, color: c, fillColor: c,
          fillOpacity: z.intensity * 0.18, weight: 0,
        }).addTo(_map);
        L.circle([z.lat, z.lng], {
          radius: 300, color: c, fillColor: "transparent",
          weight: 1.5, dashArray: "4 3",
        }).bindTooltip(`${z.label} · ${Math.round(z.intensity*100)}% yoğun`, {
          className: "map-tip",
        }).addTo(_map);
      });

      _ready = true; // ← marker effect'i tetikler
    })();

    return () => {
      cancelled = true;
      _ready = false;
      _markers.forEach(m => m?.remove());
      _markers = [];
      _map?.remove(); _map = null; _L = null;
    };
  });

  // ── Effect 2: kuryeler değişince sadece marker'ları güncelle ────
  $effect(() => {
    const snap     = couriers;   // senkron oku → reaktif takip
    const selSnap  = selected;
    const isReady  = _ready;

    if (!isReady || !_map || !_L) return;

    // Eski marker'ları kaldır
    _markers.forEach(m => m?.remove());
    _markers = [];

    // Yeni marker'ları ekle
    snap.forEach(c => {
      const isSel = c.id === selSnap;
      const icon  = _L.divIcon({
        className: "",
        iconSize: [36, 44], iconAnchor: [18, 44],
        html: `<div class="c-pin ${isSel ? "c-pin-sel" : ""}">
                 <div class="c-name">${c.name.split(" ")[0]}</div>
                 <div class="c-price">${c.price} USDC</div>
               </div>
               <div class="c-tail ${isSel ? "c-tail-sel" : ""}"></div>`,
      });
      const m = _L.marker([c.lat, c.lng], { icon })
        .on("click", () => onSelect(c.id))
        .addTo(_map);
      _markers.push(m);
    });
  });
</script>

<div bind:this={mapEl} class="map"></div>

<style>
  .map { width:100%; height:100%; }

  :global(.c-pin) {
    background:#fff; border:1.5px solid var(--border);
    border-radius:8px; padding:3px 7px;
    display:flex; flex-direction:column; align-items:center;
    box-shadow:0 2px 6px #0002; cursor:pointer;
    transition:border-color .1s;
  }
  :global(.c-pin:hover), :global(.c-pin-sel) {
    border-color:var(--primary) !important;
    background:#eff6ff !important;
  }
  :global(.c-name)  { font-size:10px; font-weight:600; color:var(--text); }
  :global(.c-price) { font-size:10px; color:var(--primary); font-weight:700; }
  :global(.c-tail)  {
    width:8px; height:8px; background:#fff;
    border-right:1.5px solid var(--border); border-bottom:1.5px solid var(--border);
    transform:rotate(45deg); margin:-5px auto 0; position:relative; z-index:-1;
  }
  :global(.c-tail-sel) { border-color:var(--primary) !important; background:#eff6ff !important; }
  :global(.map-tip) {
    background:#fff !important; border:1px solid var(--border) !important;
    color:var(--muted) !important; font-size:11px !important;
    border-radius:6px !important; box-shadow:0 2px 6px #0001 !important;
  }
  :global(.map-tip::before) { display:none !important; }

  :global(.pin) {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff; box-shadow:0 2px 6px #0002;
  }
  :global(.pin-blue)  { background:#1a73e8; }
  :global(.pin-green) { background:#0f9960; }
</style>
