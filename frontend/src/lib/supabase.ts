import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { flowType: "pkce" } },
);

// ── Types matching DB schema ──────────────────────────────────────────────────

export interface DbUser {
  id:         string;
  email:      string;
  name:       string;
  wallet_enc: string;   // AES-GCM encrypted Stellar secret
  created_at: string;
}

export interface DbCourier {
  id:           string;
  vehicle:      "moto" | "car" | "commercial";
  price_per_km: number;
  trust_score:  number;
  commission:   number;
  active:       boolean;
  deliveries:   number;
  earnings:     number;
  location:     { lat: number; lng: number } | null;
}

export interface DbDelivery {
  id:           string;
  sender_id:    string;
  courier_id?:  string;
  contract_id?: string;
  from_name:    string;
  to_name:      string;
  from_coords:  [number, number];
  to_coords:    [number, number];
  amount_usdc:  number;
  status:       "waiting" | "accepted" | "delivered";
  secret_hash?: string;
  created_at:   string;
}
