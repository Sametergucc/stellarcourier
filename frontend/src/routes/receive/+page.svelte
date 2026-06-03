<script lang="ts">
  import { page } from "$app/stores";
  import { onMount }  from "svelte";
  import QRCode from "qrcode";

  // URL: /receive?secret=<plain-text-secret>
  const secret = $derived($page.url.searchParams.get("secret") ?? "");
  const invalid = $derived(!secret || secret.length < 8);

  let canvas: HTMLCanvasElement;

  $effect(() => {
    if (!canvas || invalid) return;
    QRCode.toCanvas(canvas, secret, {
      width:             300,
      margin:            2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });
  });
</script>

<svelte:head><title>StellarCourier — Show to Courier</title></svelte:head>

<main>
  {#if invalid}
    <p class="error">Invalid delivery link.</p>
  {:else}
    <h2>Show this QR to your courier</h2>
    <canvas bind:this={canvas}></canvas>
    <p class="hint">Do not share this screen with anyone except the courier.</p>
  {/if}
</main>

<style>
  main   { display:flex; flex-direction:column; align-items:center;
           justify-content:center; min-height:100dvh; gap:1rem;
           font-family:system-ui; padding:1rem; }
  canvas { border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,.15); }
  h2     { margin:0; font-size:1.2rem; }
  .hint  { color:#666; font-size:.85rem; max-width:280px; text-align:center; }
  .error { color:#c00; font-weight:600; }
</style>
