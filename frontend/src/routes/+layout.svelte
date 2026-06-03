<script lang="ts">
  import "../app.css";
  import "leaflet/dist/leaflet.css";
  import { onMount }                           from "svelte";
  import { page }                              from "$app/stores";
  import { initAuth, signInWithGoogle,
           signOut, currentUser, walletAddress } from "$lib/auth";
  import { t, lang, toggleLang }               from "$lib/i18n";

  const nav = [
    { href: "/",        key: "nav.home"    },
    { href: "/send",    key: "nav.send"    },
    { href: "/courier", key: "nav.courier" },
    { href: "/agents",  key: "nav.agents"  },
  ];

  onMount(() => initAuth());

  const user     = $derived($currentUser);
  const wallet   = $derived($walletAddress);
  const avatar   = $derived(user?.user_metadata?.picture as string | undefined);
  const fullName = $derived((user?.user_metadata?.full_name as string | undefined) ?? "");

  let showWallet = $state(false);

  function copyAddress() {
    if (wallet) navigator.clipboard.writeText(wallet);
  }
</script>

<div class="shell">
  <nav class="nav">
    <a href="/" class="brand">
      <img src="/logodeneme1.png" alt="StellarCourier" class="brand-logo" />
      StellarCourier
    </a>

    <div class="nav-links">
      {#each nav as n}
        <a href={n.href} class="nav-link" class:active={$page.url.pathname === n.href}>
          {$t(n.key)}
        </a>
      {/each}
    </div>

    <div class="nav-end">
      <span class="net-pill">Testnet</span>
      <button class="lang-btn" onclick={toggleLang}>{$lang === "tr" ? "🌐 EN" : "🌐 TR"}</button>

      {#if user}
        <!-- Cüzdan butonu -->
        <div class="wallet-wrap">
          <button class="wallet-btn" onclick={() => showWallet = !showWallet}>
            <span class="wallet-icon">⬡</span>
            {$t("nav.wallet")}
          </button>

          {#if showWallet}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="wallet-dropdown">
              <div class="wd-label">Stellar Adresi</div>
              <div class="wd-addr">{wallet}</div>
              <button class="wd-copy" onclick={copyAddress}>{$t("nav.copy")}</button>
              <div class="wd-note">{$t("nav.walletNote")}</div>
            </div>
            <div class="backdrop" onclick={() => showWallet = false}></div>
          {/if}
        </div>

        <!-- Profil -->
        <div class="profile">
          {#if avatar}
            <img src={avatar} alt={fullName} class="avatar" />
          {:else}
            <div class="avatar-fallback">{fullName[0] ?? "U"}</div>
          {/if}
          <span class="profile-name">{fullName}</span>
          <button class="sign-out" onclick={signOut} title="Çıkış">✕</button>
        </div>

      {:else}
        <button class="btn-google" onclick={signInWithGoogle}>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {$t("nav.signin")}
        </button>
      {/if}
    </div>
  </nav>

  <main class="main">
    <slot />
  </main>
</div>

<style>
  .shell { display:flex; flex-direction:column; height:100vh; }

  .nav {
    height: 52px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex; align-items: center;
    padding: 0 1.5rem; gap: 1.5rem;
    flex-shrink: 0; position: relative; z-index: 100;
  }

  .brand {
    display: flex; align-items: center; gap: .4rem;
    font-weight: 700; font-size: .9rem;
    color: var(--text); text-decoration: none; flex-shrink: 0;
  }
  .mark { color: var(--primary); }
  .brand-logo { width: 24px; height: 24px; object-fit: contain; }

  .nav-links { display: flex; align-items: center; gap: .15rem; flex: 1; }
  .nav-link {
    padding: .35rem .7rem; border-radius: var(--radius);
    color: var(--muted); text-decoration: none;
    font-size: .85rem; font-weight: 500;
    transition: background .12s, color .12s;
  }
  .nav-link:hover  { background: var(--bg); color: var(--text); }
  .nav-link.active { background: #eff6ff; color: var(--primary); }

  .nav-end { display: flex; align-items: center; gap: .6rem; margin-left: auto; }

  .lang-btn {
    font-size: .72rem; font-weight: 600; padding: .2rem .6rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 99px; cursor: pointer; color: var(--muted);
    font-family: inherit; transition: background .12s, color .12s;
  }
  .lang-btn:hover { background: var(--bg); color: var(--primary); border-color: var(--primary); }

  .net-pill {
    font-size: .72rem; font-weight: 600; padding: .2rem .6rem;
    background: #f0fdf4; color: var(--success);
    border: 1px solid #bbf7d0; border-radius: 99px;
  }

  /* ── Wallet ── */
  .wallet-wrap { position: relative; }

  .wallet-btn {
    display: flex; align-items: center; gap: .4rem;
    padding: .38rem .8rem; font-size: .8rem; font-weight: 500;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); cursor: pointer; color: var(--text);
    transition: background .12s, border-color .12s;
  }
  .wallet-btn:hover { background: var(--bg); border-color: var(--primary); color: var(--primary); }
  .wallet-icon { font-size: .9rem; }

  .wallet-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 1rem;
    min-width: 280px; box-shadow: 0 4px 20px #0002;
    display: flex; flex-direction: column; gap: .5rem;
    z-index: 200;
  }
  .wd-label { font-size: .7rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .wd-addr  { font-family: monospace; font-size: .72rem; word-break: break-all;
              background: var(--bg); border: 1px solid var(--border);
              border-radius: 6px; padding: .5rem .6rem; color: var(--text); }
  .wd-copy  {
    padding: .4rem; font-size: .78rem; font-weight: 500;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); cursor: pointer; color: var(--text);
    font-family: inherit; transition: background .12s;
  }
  .wd-copy:hover { background: #eff6ff; border-color: var(--primary); color: var(--primary); }
  .wd-note  { font-size: .7rem; color: var(--muted); line-height: 1.4; }

  .backdrop {
    position: fixed; inset: 0; z-index: 199;
  }

  /* ── Profile ── */
  .profile {
    display: flex; align-items: center; gap: .5rem;
    padding: .28rem .6rem;
    border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface);
  }
  .avatar {
    width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
  }
  .avatar-fallback {
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--primary); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; font-weight: 700; flex-shrink: 0;
  }
  .profile-name { font-size: .82rem; font-weight: 600; white-space: nowrap; }

  .sign-out {
    background: none; border: none; color: var(--muted);
    font-size: .72rem; cursor: pointer; padding: .1rem .25rem;
    border-radius: 4px; line-height: 1; margin-left: .1rem;
  }
  .sign-out:hover { background: var(--bg); color: var(--danger); }

  /* ── Google button ── */
  .btn-google {
    display: flex; align-items: center; gap: .5rem;
    padding: .38rem .85rem; font-size: .8rem; font-weight: 500;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); cursor: pointer; color: var(--text);
    font-family: inherit; transition: background .12s;
  }
  .btn-google:hover { background: var(--bg); }

  .main { flex: 1; overflow: hidden; }
</style>
