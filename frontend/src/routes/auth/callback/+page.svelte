<script lang="ts">
  import { onMount } from "svelte";
  import { goto }    from "$app/navigation";
  import { supabase } from "$lib/supabase";

  let status = $state("Giriş tamamlanıyor…");

  onMount(async () => {
    try {
      // PKCE flow: Supabase sends ?code=... in the URL
      const params = new URL(location.href).searchParams;
      const code   = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        // Implicit flow fallback: session in URL hash
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
      }

      goto("/");
    } catch (e: any) {
      status = `Hata: ${e?.message ?? "Bilinmeyen hata"}`;
      setTimeout(() => goto("/"), 2000);
    }
  });
</script>

<div class="wrap">
  <div class="spinner"></div>
  <p>{status}</p>
</div>

<style>
  .wrap {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; gap: 1rem;
    font-family: system-ui; color: #6b7280;
  }
  .spinner {
    width: 28px; height: 28px;
    border: 2.5px solid #e8eaed; border-top-color: #1a73e8;
    border-radius: 50%; animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: .875rem; }
</style>
