/** 16-byte CSPRNG secret → 32-char lowercase hex string. */
export function generateSecret(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of the secret as a hex string.
 * Compatible with Soroban BytesN<32> — pass to initializeDelivery as secretHash.
 */
export async function hashSecret(secret: string): Promise<string> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of the secret as Uint8Array.
 * Use this when calling initializeDelivery({ secretHash }).
 */
export async function hashSecretBytes(secret: string): Promise<Uint8Array> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(raw);
}

/**
 * UTF-8 encode a plain-text secret string → Uint8Array.
 * Use this when calling releaseDelivery({ secret }) after a QR scan.
 */
export function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Pack a hex string into a Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd hex length");
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}
