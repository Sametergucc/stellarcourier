import { sveltekit } from "@sveltejs/kit/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

function passkeyKitCompat(): Plugin {
  return {
    name: "passkey-kit-soroban-compat",
    transform(code, id) {
      if (id.includes("passkey-kit") && id.endsWith("kit.ts")) {
        return {
          code: code.replace(
            "Transaction, SorobanRpc, Operation",
            "Transaction, rpc as SorobanRpc, Operation"
          ),
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [
    nodePolyfills({
      include:         ["buffer", "crypto", "stream", "util", "events", "http", "https"],
      protocolImports: true,
    }),
    passkeyKitCompat(),
    sveltekit(),
  ],
  define: { global: "globalThis" },
  optimizeDeps: {
    include: ["@stellar/stellar-sdk", "base64url", "qrcode"],
  },
});
