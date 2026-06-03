import { writable, derived, get } from "svelte/store";
import { supabase } from "$lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Vehicle = "moto" | "car" | "commercial";

export interface CourierProfile {
  address:    string;
  name:       string;
  vehicle:    Vehicle;
  pricePerKm: number;
  trustScore: number;
  commission: number;
  location:   [number,number] | null;
  active:     boolean;
  earnings:   number;
  deliveries: number;
}

export interface Package {
  id:         string;
  from:       string;
  to:         string;
  fromCoords: [number,number];
  toCoords:   [number,number];
  amount:     number;
  distKm:     number;
  eta:        string;
  status:     "waiting" | "accepted" | "delivered";
  courierId?: string;
  secret?:    string;
}

// ── Seed Packages (kurye haritasında görünsün) ────────────────────────────────

const SEED_PACKAGES: Package[] = [
  { id:"SC-001", from:"Üsküdar",         to:"Beşiktaş",      fromCoords:[41.0250,29.0150], toCoords:[41.0430,29.0050], amount:11.50, distKm:4.2, eta:"18 dk", status:"waiting" },
  { id:"SC-002", from:"Kadıköy",         to:"Sarıyer",        fromCoords:[41.0080,29.0240], toCoords:[41.1660,29.0570], amount:9.80,  distKm:3.1, eta:"12 dk", status:"waiting" },
  { id:"SC-003", from:"Fatih",           to:"Üsküdar",        fromCoords:[41.0170,28.9400], toCoords:[41.0250,29.0150], amount:14.20, distKm:6.0, eta:"25 dk", status:"waiting" },
  { id:"SC-004", from:"Maltepe",         to:"Kadıköy",        fromCoords:[40.9320,29.1300], toCoords:[41.0080,29.0240], amount:8.50,  distKm:2.8, eta:"11 dk", status:"waiting" },
  { id:"SC-005", from:"Beşiktaş",        to:"Sarıyer",        fromCoords:[41.0430,29.0050], toCoords:[41.1660,29.0570], amount:12.00, distKm:5.5, eta:"22 dk", status:"waiting" },
  { id:"SC-006", from:"Şişli",           to:"Beyoğlu",        fromCoords:[41.0600,28.9870], toCoords:[41.0340,28.9770], amount:9.00,  distKm:3.2, eta:"13 dk", status:"waiting" },
  { id:"SC-007", from:"Ataşehir",        to:"Ümraniye",       fromCoords:[40.9910,29.1180], toCoords:[41.0170,29.1000], amount:10.50, distKm:3.8, eta:"15 dk", status:"waiting" },
  { id:"SC-008", from:"Bakırköy",        to:"Fatih",          fromCoords:[40.9820,28.8740], toCoords:[41.0180,28.9410], amount:13.00, distKm:5.0, eta:"20 dk", status:"waiting" },
  { id:"SC-009", from:"Kartal",          to:"Maltepe",        fromCoords:[40.9080,29.1900], toCoords:[40.9340,29.1320], amount:7.50,  distKm:2.5, eta:"10 dk", status:"waiting" },
  { id:"SC-010", from:"Pendik",          to:"Kartal",         fromCoords:[40.8770,29.2310], toCoords:[40.9080,29.1900], amount:8.00,  distKm:3.0, eta:"12 dk", status:"waiting" },
  { id:"SC-011", from:"Kağıthane",       to:"Şişli",          fromCoords:[41.0830,28.9830], toCoords:[41.0600,28.9870], amount:9.50,  distKm:2.7, eta:"11 dk", status:"waiting" },
  { id:"SC-012", from:"Avcılar",         to:"Bakırköy",       fromCoords:[40.9800,28.7220], toCoords:[40.9820,28.8740], amount:11.00, distKm:4.5, eta:"18 dk", status:"waiting" },
  { id:"SC-013", from:"Esenyurt",        to:"Avcılar",        fromCoords:[41.0330,28.6760], toCoords:[40.9800,28.7220], amount:8.50,  distKm:3.5, eta:"14 dk", status:"waiting" },
  { id:"SC-014", from:"Sarıyer",         to:"Beşiktaş",       fromCoords:[41.1670,29.0570], toCoords:[41.0430,29.0050], amount:15.00, distKm:6.5, eta:"26 dk", status:"waiting" },
  { id:"SC-015", from:"Gaziosmanpaşa",   to:"Kağıthane",      fromCoords:[41.0670,28.9120], toCoords:[41.0830,28.9830], amount:10.00, distKm:3.8, eta:"15 dk", status:"waiting" },
];

// ── Stores ────────────────────────────────────────────────────────────────────

export const courierProfile = writable<CourierProfile | null>(null);
export const packages       = writable<Package[]>(SEED_PACKAGES);
export const activeDelivery = writable<Package | null>(null);
export const myLocation     = writable<[number,number] | null>(null);

export const waitingPackages  = derived(packages, $p => $p.filter(p => p.status === "waiting"));
export const acceptedPackages = derived(packages, $p => $p.filter(p => p.status === "accepted"));

// ── DB Loaders ────────────────────────────────────────────────────────────────

export async function loadCourierProfile(userId: string, stellarAddress: string) {
  const { data } = await supabase
    .from("couriers")
    .select("*, users(name)")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return;

  courierProfile.set({
    address:    stellarAddress,
    name:       (data as any).users?.name ?? "",
    vehicle:    data.vehicle as Vehicle,
    pricePerKm: Number(data.price_per_km),
    trustScore: Number(data.trust_score),
    commission: Number(data.commission),
    location:   data.location ? [data.location.lat, data.location.lng] : null,
    active:     data.active,
    earnings:   Number(data.earnings),
    deliveries: data.deliveries,
  });
}

export async function saveCourierProfile(
  userId:  string,
  profile: CourierProfile,
  plate?:  string,
) {
  await supabase.from("users")
    .update({ name: profile.name })
    .eq("id", userId);

  await supabase.from("couriers").upsert({
    id:           userId,
    vehicle:      profile.vehicle,
    price_per_km: profile.pricePerKm,
    trust_score:  profile.trustScore,
    commission:   profile.commission,
    active:       profile.active,
    earnings:     profile.earnings,
    deliveries:   profile.deliveries,
  });

  if (plate) {
    await supabase.from("courier_vehicles").upsert({
      courier_id:   userId,
      plate:        plate.toUpperCase().replace(/\s/g, ""),
      vehicle_type: profile.vehicle,
    }, { onConflict: "plate" });
  }
}

export async function loadDeliveries() {
  const { data } = await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: false });

  if (data?.length) {
    packages.update(existing => {
      const seedIds = new Set(existing.map(p => p.id));
      const dbPkgs  = data
        .filter(d => !seedIds.has(d.id))
        .map(d => ({
          id:         d.id,
          from:       d.from_name,
          to:         d.to_name,
          fromCoords: d.from_coords as [number, number],
          toCoords:   d.to_coords  as [number, number],
          amount:     Number(d.amount_usdc),
          distKm:     Number(d.dist_km ?? 0),
          eta:        d.eta ?? "—",
          status:     d.status as Package["status"],
        }));
      return [...existing, ...dbPkgs];
    });
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function acceptPackage(pkg: Package, courierId: string, dbUserId?: string) {
  packages.update(ps =>
    ps.map(p => p.id === pkg.id ? { ...p, status: "accepted", courierId } : p)
  );
  activeDelivery.set({ ...pkg, status: "accepted", courierId });

  if (dbUserId) {
    await supabase.from("deliveries")
      .update({ status: "accepted", courier_id: dbUserId })
      .eq("id", pkg.id);
  }
}

export async function deliverPackage(pkgId: string, dbUserId?: string) {
  const pkg = get(packages).find(p => p.id === pkgId);

  packages.update(ps =>
    ps.map(p => p.id === pkgId ? { ...p, status: "delivered" } : p)
  );
  activeDelivery.set(null);

  courierProfile.update(cp => cp
    ? { ...cp, earnings: cp.earnings + (pkg?.amount ?? 0), deliveries: cp.deliveries + 1 }
    : cp
  );

  if (dbUserId) {
    await supabase.from("deliveries")
      .update({ status: "delivered" })
      .eq("id", pkgId);

    const cp = get(courierProfile);
    if (cp) {
      await supabase.from("couriers")
        .update({ earnings: cp.earnings, deliveries: cp.deliveries })
        .eq("id", dbUserId);
    }
  }
}

// ── Active Couriers (for send page) ──────────────────────────────────────────

export interface ActiveCourier {
  id:             string;
  name:           string;
  stellarAddress: string;
  vehicle:        Vehicle;
  pricePerKm:     number;
  rating:         number;
  location:       [number, number] | null;
}

export function haversineKm(a: [number,number], b: [number,number]): number {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 +
    Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function loadActiveCouriers(): Promise<ActiveCourier[]> {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, vehicle, price_per_km, rating, location, users(name, stellar_address)")
    .eq("active", true)
    .eq("suspended", false);

  if (error) {
    console.error("loadActiveCouriers error:", error.message, error.details);
    // stellar_address kolonu yoksa tekrar dene
    if (error.message?.includes("stellar_address")) {
      const { data: d2, error: e2 } = await supabase
        .from("couriers")
        .select("id, vehicle, price_per_km, rating, location, users(name)")
        .eq("active", true)
        .eq("suspended", false);
      if (e2) { console.error("fallback error:", e2.message); return []; }
      return (d2 ?? []).filter((d: any) => d.location).map((d: any) => ({
        id:             d.id,
        name:           d.users?.name || "Kurye",
        stellarAddress: "",
        vehicle:        d.vehicle as Vehicle,
        pricePerKm:     Number(d.price_per_km),
        rating:         Number(d.rating),
        location:       [d.location.lat, d.location.lng],
      }));
    }
    return [];
  }

  if (!data?.length) return [];
  return data
    .filter((d: any) => d.location)
    .map((d: any) => ({
      id:             d.id,
      name:           d.users?.name || "Kurye",
      stellarAddress: d.users?.stellar_address || "",
      vehicle:        d.vehicle as Vehicle,
      pricePerKm:     Number(d.price_per_km),
      rating:         Number(d.rating),
      location:       [d.location.lat, d.location.lng] as [number, number],
    }));
}

// ── Realtime subscription (courier panel) ─────────────────────────────────────

export function subscribeDeliveries(): () => void {
  const ch = supabase.channel("deliveries-rt")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "deliveries" },
      ({ new: d }) => {
        if (d.status !== "waiting") return;
        packages.update(ps => [{
          id:         d.id,
          from:       d.from_name,
          to:         d.to_name,
          fromCoords: d.from_coords as [number,number],
          toCoords:   d.to_coords   as [number,number],
          amount:     Number(d.amount_usdc),
          distKm:     Number(d.dist_km ?? 0),
          eta:        d.eta ?? "—",
          status:     "waiting" as const,
        }, ...ps]);
      })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deliveries" },
      ({ new: d }) => {
        packages.update(ps =>
          d.status === "waiting"
            ? ps.map(p => p.id === d.id ? { ...p, status: d.status } : p)
            : ps.filter(p => p.id !== d.id)
        );
      })
    .subscribe();

  return () => { supabase.removeChannel(ch); };
}

export function startLocationTracking() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    pos => myLocation.set([pos.coords.latitude, pos.coords.longitude]),
    _   => myLocation.set([41.015, 28.980]),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
  );
}
