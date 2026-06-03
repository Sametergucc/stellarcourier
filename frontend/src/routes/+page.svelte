<script lang="ts">
  import { goto }                         from "$app/navigation";
  import { currentUser, signInWithGoogle } from "$lib/auth";
  import { t }                             from "$lib/i18n";

  const user = $derived($currentUser);

  function goTo(path: string) {
    if (!user) return; // gate handles redirect visually
    goto(path);
  }
</script>

<svelte:head><title>StellarCourier</title></svelte:head>

<div class="landing">
  <div class="hero">
    <img src="/logodeneme1.png" alt="StellarCourier" class="hero-logo" />
    <h1>StellarCourier</h1>
    <p>{$t("home.desc")}</p>
  </div>

  <div class="cards">
    <button class="role-card" class:locked={!user} onclick={() => goTo("/send")}>
      <div class="role-icon">📦</div>
      <h2>{$t("home.sendTitle")}</h2>
      <p>{$t("home.sendDesc")}</p>
      {#if user}
        <span class="role-cta">{$t("home.continue")}</span>
      {:else}
        <span class="role-locked">{$t("home.locked")}</span>
      {/if}
    </button>

    <button class="role-card" class:locked={!user} onclick={() => goTo("/courier")}>
      <div class="role-icon">🛵</div>
      <h2>{$t("home.courierTitle")}</h2>
      <p>{$t("home.courierDesc")}</p>
      {#if user}
        <span class="role-cta">{$t("home.continue")}</span>
      {:else}
        <span class="role-locked">{$t("home.locked")}</span>
      {/if}
    </button>
  </div>

  {#if !user}
    <div class="login-section">
      <p class="login-label">{$t("home.loginLabel")}</p>
      <button class="btn-google" onclick={signInWithGoogle}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {$t("home.googleBtn")}
      </button>
    </div>
  {:else}
    <p class="welcome">{$t("home.welcome")} <b>{(user.user_metadata?.full_name as string)?.split(" ")[0] ?? "User"}</b> — {$t("home.welcomeSub")}</p>
  {/if}

  <p class="footer">{$t("home.footer")}</p>
</div>

<style>
  .landing {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 100%;
    padding: 3rem 1.5rem; gap: 2rem;
  }

  .hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: .75rem; }
  .hero-logo { width: 180px; height: 180px; object-fit: contain; }
  h1  { font-size: 1.8rem; font-weight: 700; }
  .hero p { color: var(--muted); font-size: .875rem; max-width: 400px; line-height: 1.6; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 600px; width: 100%; }

  .role-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: .7rem;
    padding: 1.5rem; background: var(--surface);
    border: 1px solid var(--border); border-radius: 12px;
    text-align: left; cursor: pointer;
    transition: border-color .15s, box-shadow .15s;
  }
  .role-card:not(.locked):hover {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px #1a73e810;
  }
  .role-card.locked { cursor: default; opacity: .75; }

  .role-icon { font-size: 1.8rem; }
  .role-card h2 { font-size: 1rem; font-weight: 700; }
  .role-card p  { font-size: .8rem; color: var(--muted); line-height: 1.5; }
  .role-cta  { font-size: .82rem; font-weight: 600; color: var(--primary); }
  .role-locked { font-size: .78rem; color: var(--muted); }

  /* Login */
  .login-section {
    display: flex; flex-direction: column; align-items: center; gap: .75rem;
    padding: 1.5rem; background: var(--surface);
    border: 1px solid var(--border); border-radius: 12px;
    max-width: 340px; width: 100%; text-align: center;
  }
  .login-label { font-size: .85rem; color: var(--muted); }

  .btn-google {
    display: flex; align-items: center; gap: .6rem;
    padding: .55rem 1.4rem; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius);
    cursor: pointer; font-size: .875rem; font-weight: 500;
    color: var(--text); font-family: inherit; width: 100%;
    justify-content: center; transition: background .12s;
  }
  .btn-google:hover { background: var(--bg); }

  .welcome { font-size: .85rem; color: var(--muted); }
  .footer  { font-size: .72rem; color: var(--muted); }
</style>
