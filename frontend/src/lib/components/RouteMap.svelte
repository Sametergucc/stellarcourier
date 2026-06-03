<!-- Map for route selection: user clicks two points (origin + destination) -->
<script lang="ts">
  interface Props {
    onRoute:      (origin: [number,number], dest: [number,number]) => void;
    forcedOrigin?: [number,number] | null;
  }
  const { onRoute, forcedOrigin = null }: Props = $props();

  let mapEl: HTMLDivElement | undefined = $state();
  let originLabel = $state("");
  let destLabel   = $state("");

  // Refs shared between effects
  let _L:            any = null;
  let _map:          any = null;
  let _iconOrigin:   any = null;
  let _iconDest:     any = null;
  let _originMarker: any = null;
  let _destMarker:   any = null;
  let _polyline:     any = null;
  let _clicks:       [number,number][] = [];
  let _dest:         [number,number] | null = null;

  // Map init
  $effect(() => {
    if (!mapEl) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl) return;

      _L = L;
      _map = L.map(mapEl, { zoomControl: false }).setView([41.015, 28.980], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO", maxZoom: 19,
      }).addTo(_map);
      L.control.zoom({ position: "bottomright" }).addTo(_map);

      _iconOrigin = L.divIcon({ className: "", iconSize: [30,30], iconAnchor: [15,15], html: `<div class="pin pin-blue">A</div>` });
      _iconDest   = L.divIcon({ className: "", iconSize: [30,30], iconAnchor: [15,15], html: `<div class="pin pin-green">B</div>` });

      _map.on("click", (e: any) => {
        const latlng: [number,number] = [e.latlng.lat, e.latlng.lng];
        _clicks.push(latlng);

        if (_clicks.length === 1) {
          _originMarker?.remove();
          _originMarker = L.marker(latlng, { icon: _iconOrigin }).addTo(_map);
          originLabel = `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
          destLabel   = "";
          _dest       = null;
        } else if (_clicks.length === 2) {
          _destMarker?.remove(); _polyline?.remove();
          _dest = latlng;
          _destMarker = L.marker(latlng, { icon: _iconDest }).addTo(_map);
          destLabel   = `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
          _polyline   = L.polyline([_clicks[0], latlng], { color: "#1a73e8", weight: 2.5, dashArray: "6 4", opacity: .7 }).addTo(_map);
          _map.fitBounds([_clicks[0], latlng], { padding: [50, 50] });
          onRoute(_clicks[0], latlng);
          _clicks = [];
        } else {
          _originMarker?.remove(); _destMarker?.remove(); _polyline?.remove();
          _dest = null; _clicks = [latlng];
          _originMarker = L.marker(latlng, { icon: _iconOrigin }).addTo(_map);
          originLabel   = `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
          destLabel     = "";
        }
      });
    })();

    return () => { cancelled = true; _map?.remove(); _map = null; _L = null; };
  });

  // React to forced origin (GPS button)
  $effect(() => {
    const loc = forcedOrigin;
    if (!loc || !_map || !_L) return;

    _originMarker?.remove();
    _originMarker = _L.marker(loc, { icon: _iconOrigin }).addTo(_map);
    originLabel   = `${loc[0].toFixed(4)}, ${loc[1].toFixed(4)}`;
    _map.setView(loc, 14);

    if (_dest) {
      _polyline?.remove();
      _polyline = _L.polyline([loc, _dest], { color: "#1a73e8", weight: 2.5, dashArray: "6 4", opacity: .7 }).addTo(_map);
      _map.fitBounds([loc, _dest], { padding: [50, 50] });
      onRoute(loc, _dest);
      _clicks = [];
    } else {
      _clicks = [loc]; // next click → B
    }
  });
</script>

<div class="wrap">
  <div bind:this={mapEl} class="map"></div>
  <div class="hint-bar">
    <div class="hint-item">
      <span class="pin-sm pin-blue">A</span>
      <span>{originLabel || "Haritaya tıklayarak başlangıç noktası seç"}</span>
    </div>
    <div class="hint-item">
      <span class="pin-sm pin-green">B</span>
      <span>{destLabel || "Teslim noktasını seç"}</span>
    </div>
  </div>
</div>

<style>
  .wrap { display:flex; flex-direction:column; height:100%; }
  .map  { flex:1; }
  .hint-bar {
    padding:.6rem 1rem; background:var(--surface);
    border-top:1px solid var(--border);
    display:flex; gap:1.5rem;
  }
  .hint-item { display:flex; align-items:center; gap:.5rem; font-size:.78rem; color:var(--muted); }

  :global(.pin) {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff;
    box-shadow:0 2px 6px #0002;
  }
  :global(.pin-blue)  { background:#1a73e8; }
  :global(.pin-green) { background:#0f9960; }

  .pin-sm {
    width:20px; height:20px; border-radius:50%;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700; color:#fff; flex-shrink:0;
  }
</style>
