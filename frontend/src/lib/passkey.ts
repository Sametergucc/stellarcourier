/**
 * Wallet signing — uses the keypair managed by auth.ts.
 * If no Google login yet, falls back to localStorage mock.
 */
import { Keypair, Transaction } from "@stellar/stellar-sdk";
import { get }                  from "svelte/store";
import { walletAddress, walletKeyId, currentUser } from "./auth";

export type WalletState = { keyId: string; address: string };

const LOCAL_KEY = "sc:secret";

export async function registerWallet(_username: string): Promise<WalletState> {
  // If logged in via Google, use that wallet
  const user = get(currentUser);
  if (user) {
    return { keyId: get(walletKeyId), address: get(walletAddress) };
  }
  // Fallback: local keypair
  const kp = Keypair.random();
  localStorage.setItem(LOCAL_KEY, kp.secret());
  await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`).catch(() => {});
  return { keyId: kp.secret(), address: kp.publicKey() };
}

export async function connectWallet(): Promise<WalletState> {
  const user = get(currentUser);
  if (user) {
    return { keyId: get(walletKeyId), address: get(walletAddress) };
  }
  const secret = localStorage.getItem(LOCAL_KEY);
  if (!secret) return registerWallet("returning");
  const kp = Keypair.fromSecret(secret);
  return { keyId: secret, address: kp.publicKey() };
}

export async function signWithKit(tx: Transaction, keyId: string): Promise<Transaction> {
  tx.sign(Keypair.fromSecret(keyId));
  return tx;
}

export const clearWallet = () => localStorage.removeItem(LOCAL_KEY);
export const storedKeyId = () => localStorage.getItem(LOCAL_KEY);
