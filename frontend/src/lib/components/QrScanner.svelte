<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

  interface Props {
    onScan:  (secret: string) => void;
    onError?: (msg: string)   => void;
  }
  const { onScan, onError }: Props = $props();

  const ELEMENT_ID = "qr-scanner-region";
  let scanner: Html5Qrcode;
  let started = false;

  onMount(async () => {
    scanner = new Html5Qrcode(ELEMENT_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });

    await scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: { width: 260, height: 260 } },
      (decodedText) => {
        // Stop after first successful scan to prevent repeated triggers
        if (started) return;
        started = true;
        scanner.stop().catch(() => {});
        onScan(decodedText.trim());
      },
      (errMsg) => onError?.(errMsg),
    );
  });

  onDestroy(() => {
    scanner?.stop().catch(() => {});
  });
</script>

<div id={ELEMENT_ID} style="width:300px;border-radius:8px;overflow:hidden;"></div>
