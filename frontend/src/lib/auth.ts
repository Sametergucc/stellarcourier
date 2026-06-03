import { supabase }  from "./supabase";
import { Keypair }    from "@stellar/stellar-sdk";
import { Buffer }     from "buffer";
import { writable, get } from "svelte/store";
import type { User }  from "@supabase/supabase-js";

// ── Store ─────────────────────────────────────────────────────────────────────

export const currentUser   = writable<User | null>(null);
export const walletAddress = writable<string>("");
export const walletKeyId   = writable<string>("");   // secret (testnet only)

// Bootstrap on import — listen for auth changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user ?? null;
  currentUser.set(user);
  if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
    await ensureWallet(user);
  }
  if (event === "SIGNED_OUT") {
    walletAddress.set("");
    walletKeyId.set("");
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback` },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser.set(null);
  walletAddress.set("");
  walletKeyId.set("");
}

// ── Wallet management ─────────────────────────────────────────────────────────

async function deriveKey(sub: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(sub), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode("stellarcourier-v1"),
      iterations: 100_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  const buf = new Uint8Array(iv.byteLength + enc.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(enc), iv.byteLength);
  return btoa(String.fromCharCode(...buf));
}

async function decrypt(b64: string, key: CryptoKey): Promise<string> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv  = buf.slice(0, 12);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    buf.slice(12),
  );
  return new TextDecoder().decode(dec);
}

// Kullanıcı ID'sinden deterministik anahtar üret — her girişte aynı adres,
// anında, hiçbir ağ bağımlılığı yok. (testnet/demo)
async function deriveKeypair(seed: string): Promise<Keypair> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`stellarcourier:${seed}`),
  );
  return Keypair.fromRawEd25519Seed(Buffer.from(new Uint8Array(hash)));
}

async function ensureWallet(user: User) {
  // Cüzdanı anında oluştur (gerçekçi G... adresi)
  const kp = await deriveKeypair(user.id);
  walletAddress.set(kp.publicKey());
  walletKeyId.set(kp.secret());

  // DB senkronu arka planda — başarısız olsa da cüzdanı etkilemez
  supabase.from("users").upsert({
    id:              user.id,
    email:           user.email ?? "",
    name:            user.user_metadata?.full_name ?? "",
    stellar_address: kp.publicKey(),
  }).then(undefined, () => {});
}

// Manuel cüzdan bağlama / tekrar deneme — mevcut oturumdaki kullanıcı için
export async function connectWallet(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return false;
  await ensureWallet(user);
  return !!get(walletAddress);
}

// ── Current session on page load ──────────────────────────────────────────────

export async function initAuth() {
  // onAuthStateChange handles INITIAL_SESSION and SIGNED_IN automatically
  await supabase.auth.getSession();
}
