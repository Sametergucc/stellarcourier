<script lang="ts">
  let mapEl: HTMLDivElement | undefined = $state();

  const COURIERS = [
    { id:"c1", name:"Ahmet K.",  lat:41.0155, lng:28.9795, status:"active",  rating:4.8 },
    { id:"c2", name:"Mehmet Y.", lat:40.9912, lng:29.0215, status:"busy",    rating:4.5 },
    { id:"c3", name:"Ali R.",    lat:41.0344, lng:28.9514, status:"active",  rating:4.2 },
    { id:"c4", name:"Fatma S.",  lat:41.0082, lng:29.0454, status:"active",  rating:4.9 },
    { id:"c5", name:"Kemal D.",  lat:41.0621, lng:29.0012, status:"offline", rating:3.8 },
  ] as const;

  const ZONES = [
    { lat:41.015, lng:28.980, intensity:0.92, label:"Kadıköy"  },
    { lat:41.035, lng:28.977, intensity:0.75, label:"Beşiktaş" },
    { lat:41.008, lng:28.956, intensity:0.55, label:"Fatih"    },
    { lat:41.042, lng:29.009, intensity:0.83, label:"Üsküdar"  },
    { lat:41.063, lng:29.001, intensity:0.61, label:"Sarıyer"  },
    { lat:40.985, lng:29.033, intensity:0.47, label:"Maltepe"  },
  ] as const;

  const COLOR = { active:"#10b981", busy:"#f59e0b", offline:"#64748b" } as const;

  function heatColor(i: number) {
    if (i > 0.8) return "#ef4444";
    if (i > 0.6) return "#f97316";
    if (i > 0.4) return "#f59e0b";
    return "#84cc16";
  }

  $effect(() => {
    if (!mapEl) return;

    let map: any = null;
    let markers: any[] = [];
    let timer: ReturnType<typeof setInterval>;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl) return;

      map = L.map(mapEl, { zoomControl: false }).setView([41.015, 28.980], 12);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Demand zones
      ZONES.forEach(z => {
        const c = heatColor(z.intensity);
        L.circle([z.lat, z.lng], {
          radius: z.intensity * 1800, color: c, fillColor: c,
          fillOpacity: z.intensity * 0.2, weight: 0,
        }).addTo(map);
        L.circle([z.lat, z.lng], {
          radius: 350, color: c, fillColor: c,
          fillOpacity: 0.06, weight: 1.5, dashArray: "4 4",
        }).bindTooltip(`<b>${z.label}</b><br>${Math.round(z.intensity*100)}% yoğun`, {
          className: "map-tip",
        }).addTo(map);
      });

      // Courier markers
      COURIERS.forEach(c => {
        const icon = L.divIcon({
          className: "",
          html: `<div class="c-dot" style="background:${COLOR[c.status]}">
                   ${c.name.split(" ").map(w=>w[0]).join("")}
                 </div>
                 ${c.status==="active"
                   ? `<div class="c-ring" style="border-color:${COLOR[c.status]}"></div>`
                   : ""}`,
          iconSize: [38, 38], iconAnchor: [19, 19],
        });
        const m = L.marker([c.lat, c.lng], { icon })
          .bindPopup(`<div class="c-popup">
              <strong>${c.name}</strong>
              <div>⭐ ${c.rating} &nbsp;·&nbsp; ${c.status}</div>
            </div>`)
          .addTo(map);
        markers.push({ m, status: c.status });
      });

      // Animate active couriers
      timer = setInterval(() => {
        markers.forEach(({ m, status }) => {
          if (status !== "active") return;
          const p = m.getLatLng();
          m.setLatLng([
            p.lat + (Math.random() - 0.5) * 0.0005,
            p.lng + (Math.random() - 0.5) * 0.0005,
          ]);
        });
      }, 2000);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      map?.remove();
    };
  });
</script>

<div bind:this={mapEl} class="map"></div>

<style>
  .map { width: 100%; height: 100%; }

  :global(.c-dot) {
    width:36px; height:36px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff;
    box-shadow:0 2px 8px #0009; position:relative; z-index:2;
  }
  :global(.c-ring) {
    width:54px; height:54px; border-radius:50%; border:2px solid;
    position:absolute; top:-9px; left:-9px;
    animation:rp 2s ease-out infinite; opacity:.6;
  }
  @keyframes rp {
    0%   { transform:scale(.7); opacity:.7; }
    100% { transform:scale(1.5); opacity:0; }
  }
  :global(.map-tip) {
    background:#fff !important; border:1px solid #e8eaed !important;
    color:#1f2937 !important; font-size:12px !important;
    border-radius:8px !important; box-shadow:0 2px 8px #0001 !important;
  }
  :global(.map-tip::before) { display:none !important; }
  :global(.c-popup) { font-family:system-ui; font-size:13px; min-width:110px; }
  :global(.c-popup strong) { display:block; margin-bottom:4px; font-size:14px; }
  :global(.leaflet-popup-content-wrapper) {
    background:#fff !important; border:1px solid #e8eaed !important;
    color:#1f2937 !important; border-radius:10px !important;
    box-shadow:0 4px 16px #0002 !important;
  }
  :global(.leaflet-popup-tip) { background:#fff !important; }
</style>
