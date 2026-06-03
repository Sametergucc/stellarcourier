import type { PricingSignals, Weather } from "./types";

// ── Weather ───────────────────────────────────────────────────────────────────
// Use OpenWeatherMap if VITE_OPENWEATHER_KEY set, else simulate.
export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const key = import.meta.env.VITE_OPENWEATHER_KEY;
  if (key) {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}`
      );
      const d = await r.json();
      const id: number = d.weather?.[0]?.id ?? 800;
      if (id >= 200 && id < 600) return id >= 500 ? "rainy" : "stormy";
      return "sunny";
    } catch { /* fall through to simulation */ }
  }
  const r = Math.random();
  return r < 0.6 ? "sunny" : r < 0.87 ? "rainy" : "stormy";
}

// ── Distance (Haversine) ──────────────────────────────────────────────────────
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Demand ratio ──────────────────────────────────────────────────────────────
export function computeDemandRatio(
  totalDeliveries: number,
  activeCouriers:  number,
): number {
  if (activeCouriers === 0) return 5; // infinite demand
  return totalDeliveries / activeCouriers;
}

// ── Build full signal snapshot ────────────────────────────────────────────────
export async function buildSignals(
  referenceLocation: { lat: number; lng: number },
  distanceKm: number,
  totalDeliveries: number,
  activeCouriers:  number,
): Promise<PricingSignals> {
  return {
    weather:     await fetchWeather(referenceLocation.lat, referenceLocation.lng),
    demandRatio: computeDemandRatio(totalDeliveries, activeCouriers),
    hourOfDay:   new Date().getHours(),
    distanceKm,
  };
}
