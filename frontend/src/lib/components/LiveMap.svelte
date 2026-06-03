<!-- Real-time map: courier GPS + packages + active route -->
<script lang="ts">
  import type { Package } from "$lib/store";

  interface Props {
    myLocation:     [number,number] | null;
    packages:       Package[];
    activeDelivery: Package | null;
    onSelect?:      (pkg: Package) => void;
  }
  const { myLocation, packages, activeDelivery, onSelect }: Props = $props();

  let mapEl: HTMLDivElement | undefined = $state();

  // Shared refs
  let _L:         any   = null;
  let _map:       any   = null;
  let _ready            = $state(false);
  let _myMarker:  any   = null;
  let _pkgMarkers: any[] = [];
  let _routeLine: any   = null;
  let _destMarker: any  = null;

  // ── Effect 1: haritayı bir kez kur ──────────────────────────────
  $effect(() => {
    if (!mapEl) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl) return;

      _L   = L;
      const center = myLocation ?? [41.015, 28.980];
      _map = L.map(mapEl, { zoomControl: false }).setView(center, 13);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO", maxZoom: 19,
      }).addTo(_map);
      L.control.zoom({ position: "bottomright" }).addTo(_map);

      _ready = true;
    })();

    return () => {
      cancelled = true;
      _ready = false;
      _map?.remove(); _map = null; _L = null;
    };
  });

  // ── Effect 2: konum marker ───────────────────────────────────────
  $effect(() => {
    const loc   = myLocation;
    const ready = _ready;
    if (!ready || !_map || !_L) return;

    _myMarker?.remove();
    if (loc) {
      _myMarker = _L.marker(loc, { icon: _L.divIcon({
        className: "", iconSize:[20,20], iconAnchor:[10,10],
        html: `<div class="my-dot"></div>`,
      })}).addTo(_map);
      _map.setView(loc, _map.getZoom());
    }
  });

  // ── Effect 3: paket marker'ları reaktif ─────────────────────────
  $effect(() => {
    const pkgs   = packages;
    const adel   = activeDelivery;
    const ready  = _ready;
    if (!ready || !_map || !_L) return;

    // Eski paket marker'larını temizle
    _pkgMarkers.forEach(m => m?.remove());
    _pkgMarkers = [];
    _routeLine?.remove();
    _destMarker?.remove();

    // Paket marker'ları
    pkgs.forEach(pkg => {
      if (pkg.status === "delivered") return;
      const isActive = pkg.id === adel?.id;
      const icon = _L.divIcon({
        className: "",
        iconSize:  [34, 34], iconAnchor: [17, 34],
        html: `<div class="pkg-pin ${isActive ? "pkg-pin-active" : ""}">📦</div>`,
      });
      const m = _L.marker(pkg.fromCoords, { icon })
        .bindPopup(`<div class="pp">
            <b>${pkg.from} → ${pkg.to}</b>
            <div>${pkg.amount} USDC · ${pkg.distKm} km · ${pkg.eta}</div>
          </div>`)
        .addTo(_map);
      if (onSelect && pkg.status === "waiting") {
        m.on("click", () => onSelect(pkg));
      }
      _pkgMarkers.push(m);
    });

    // Aktif teslimat rotası
    const loc = myLocation;
    if (adel && loc) {
      _routeLine = _L.polyline(
        [loc, adel.fromCoords, adel.toCoords],
        { color: "#1a73e8", weight: 2.5, dashArray: "6 4", opacity: .7 }
      ).addTo(_map);

      _destMarker = _L.marker(adel.toCoords, { icon: _L.divIcon({
        className: "",
        iconSize:  [28, 28], iconAnchor: [14, 28],
        html: `<div class="dest-pin">🏠</div>`,
      })}).addTo(_map);

      _map.fitBounds([loc, adel.fromCoords, adel.toCoords], { padding: [40, 40] });
    }
  });
</script>

<div bind:this={mapEl} class="map"></div>

<style>
  .map { width: 100%; height: 100%; }

  :global(.my-dot) {
    width: 16px; height: 16px; border-radius: 50%;
    background: #1a73e8; border: 2.5px solid #fff;
    box-shadow: 0 0 0 4px #1a73e830;
    animation: pulse-loc 2s ease-out infinite;
  }
  @keyframes pulse-loc {
    0%   { box-shadow: 0 0 0 0 #1a73e840; }
    100% { box-shadow: 0 0 0 10px #1a73e800; }
  }

  :global(.pkg-pin) {
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1.5px solid #e8eaed;
    border-radius: 50%; font-size: 16px;
    box-shadow: 0 2px 8px #0003; cursor: pointer;
    transition: border-color .12s, transform .12s;
  }
  :global(.pkg-pin:hover) { border-color: var(--primary); transform: scale(1.1); }
  :global(.pkg-pin-active) { border-color: var(--success); background: #f0fdf4; }

  :global(.dest-pin) {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1px solid #e8eaed;
    border-radius: 50%; font-size: 14px;
    box-shadow: 0 2px 6px #0002;
  }

  :global(.pp) { font-family: system-ui; font-size: 12px; line-height: 1.6; }
  :global(.pp b) { display: block; margin-bottom: 2px; }

  :global(.leaflet-popup-content-wrapper) {
    background: #fff !important; border: 1px solid #e8eaed !important;
    border-radius: 8px !important; box-shadow: 0 4px 12px #0002 !important;
    color: #1f2937 !important;
  }
  :global(.leaflet-popup-tip) { background: #fff !important; }
</style>
