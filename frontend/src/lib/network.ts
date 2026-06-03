import { Networks } from "@stellar/stellar-sdk";

export const NETWORK = {
  rpcUrl:            "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  horizonUrl:        "https://horizon-testnet.stellar.org",
} as const;

export const CONTRACT_IDS = {
  escrow:         import.meta.env.VITE_ESCROW_CONTRACT_ID  as string,
  factory:        import.meta.env.VITE_PASSKEY_FACTORY_ID  as string,
  walletWasmHash: import.meta.env.VITE_WALLET_WASM_HASH    as string,
  // Circle Testnet USDC — issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
  usdc:           import.meta.env.VITE_USDC_CONTRACT_ID    as string,
};

export const USDC_CONFIRMED_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

// Ledger ≈ 5 s → 1 day ≈ 17_280, 7 days ≈ 120_960
export const DEFAULT_EXPIRY_LEDGERS = 120_960;
