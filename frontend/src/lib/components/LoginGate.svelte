<!-- Wraps any content: shows login prompt if not authenticated -->
<script lang="ts">
  import { currentUser, signInWithGoogle } from "$lib/auth";
  import { t } from "$lib/i18n";

  interface Props { children?: import("svelte").Snippet }
  const { children }: Props = $props();

  const user = $derived($currentUser);
</script>

{#if user}
  {@render children?.()}
{:else}
  <div class="gate">
    <div class="gate-card">
      <div class="gate-icon">✦</div>
      <h3>{$t("gate.title")}</h3>
      <p>{$t("gate.desc")}</p>
      <button class="btn-google" onclick={signInWithGoogle}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {$t("gate.btn")}
      </button>
    </div>
  </div>
{/if}

<style>
  .gate {
    display: flex; align-items: center; justify-content: center;
    min-height: 100%; padding: 2rem;
  }
  .gate-card {
    text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: .9rem;
    max-width: 340px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 2rem;
  }
  .gate-icon { font-size: 2rem; color: var(--primary); }
  h3  { font-size: 1rem; font-weight: 700; }
  p   { font-size: .82rem; color: var(--muted); line-height: 1.6; }

  .btn-google {
    display: flex; align-items: center; gap: .6rem;
    padding: .55rem 1.2rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); cursor: pointer; font-size: .875rem;
    font-weight: 500; color: var(--text); font-family: inherit;
    transition: background .12s; width: 100%; justify-content: center;
  }
  .btn-google:hover { background: var(--bg); }
</style>
