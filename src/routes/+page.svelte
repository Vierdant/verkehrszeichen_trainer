<script lang="ts">
    import { onMount } from 'svelte';
    import { SIGNS, type TrafficSign, normalizeAnswer } from '$lib/signs';

    type Mode = 'easy' | 'hard';

    // State
    let mode: Mode = 'easy';
    let shuffled: TrafficSign[] = [];
    let currentIndex = 0;
    let current: TrafficSign | null = null;
    let options: string[] = []; // for easy mode
    let hardInput = '';
    let feedback: 'correct' | 'wrong' | '' = '';
    let isFlipping = false;
    let showMenu = false;
    let showHistory = false;
    let pendingMode: Mode | null = null;
    let imageReady = false;
    const loadedSrcs = new Set<string>();

    // Scoring and history
    let correct = 0;
    let wrong = 0;
    let finished = false;

    const LS_KEY = 'vz-quiz-history-v1';
    const THEME_KEY = 'vz-theme';
    let theme: 'light' | 'dark' = 'dark';

    type HistoryEntry = {
        timestamp: number;
        total: number;
        correct: number;
        wrong: number;
        mode: Mode;
    };
    let history: HistoryEntry[] = [];

    function loadHistory() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            history = raw ? JSON.parse(raw) : [];
        } catch {
            history = [];
        }
    }

    function saveHistory(entry: HistoryEntry) {
        const next = [entry, ...history].slice(0, 50);
        history = next;
        localStorage.setItem(LS_KEY, JSON.stringify(next));
    }

    function loadTheme() {
        const saved = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
        if (saved) theme = saved;
        updateThemeAttr();
    }

    function toggleTheme() {
        theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, theme);
        updateThemeAttr();
    }

    function updateThemeAttr() {
        document.documentElement.dataset.theme = theme;
    }

    function shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function startSession() {
        shuffled = shuffle(SIGNS);
        currentIndex = 0;
        correct = 0;
        wrong = 0;
        finished = false;
        feedback = '';
        hardInput = '';
        setCurrent();
    }

    function setCurrent() {
        current = shuffled[currentIndex] ?? null;
        if (!current) {
            finished = true;
            const entry = { timestamp: Date.now(), total: SIGNS.length, correct, wrong, mode };
            saveHistory(entry);
            return;
        }
        feedback = '';
        hardInput = '';
        imageReady = false;
        const src = current.src;
        if (loadedSrcs.has(src)) {
            imageReady = true;
        } else {
            const img = new Image();
            img.onload = () => {
                loadedSrcs.add(src);
                imageReady = true;
            };
            img.src = src;
        }
        if (mode === 'easy') {
            const names = [current.title];
            const distractors = shuffle(SIGNS.filter((s) => s.id !== current!.id)).slice(0, 3).map((s) => s.title);
            options = shuffle([...names, ...distractors]);
        } else {
            options = [];
        }
        // Preload next image opportunistically
        const nextSign = shuffled[currentIndex + 1];
        if (nextSign && !loadedSrcs.has(nextSign.src)) {
            const pre = new Image();
            pre.onload = () => loadedSrcs.add(nextSign.src);
            pre.src = nextSign.src;
        }
    }

    function submitEasy(choice: string) {
        if (!current || feedback) return;
        if (choice === current.title) {
            correct += 1;
            feedback = 'correct';
        } else {
            wrong += 1;
            feedback = 'wrong';
        }
    }

    function submitHard() {
        if (!current || feedback) return;
        const guess = normalizeAnswer(hardInput);
        const answers = [current.title, ...current.aliases].map(normalizeAnswer);
        if (answers.includes(guess)) {
            correct += 1;
            feedback = 'correct';
        } else {
            wrong += 1;
            feedback = 'wrong';
        }
    }

    function next() {
        if (finished) return;
        flip(() => {
            currentIndex += 1;
            setCurrent();
        });
    }

    function prev() {
        if (currentIndex === 0) return;
        flip(() => {
            currentIndex -= 1;
            setCurrent();
        });
    }

    function flip(after: () => void) {
        if (isFlipping) return; // guard to avoid double flips
        isFlipping = true;
        const DURATION = 300;
        setTimeout(() => {
            after();
            // allow the new content to render, then end flip
            setTimeout(() => { isFlipping = false; }, 20);
        }, DURATION);
    }

    function askSwitchMode(m: Mode) {
        if (mode === m) return;
        pendingMode = m;
    }

    function confirmSwitchMode() {
        if (!pendingMode) return;
        mode = pendingMode;
        pendingMode = null;
        startSession();
    }

    function cancelSwitchMode() {
        pendingMode = null;
    }

    onMount(() => {
        loadHistory();
        loadTheme();
        startSession();
    });
</script>

<svelte:head>
    <title>Verkehrszeichen Trainer</title>
</svelte:head>

<div class="app">
    <header class="topbar">
        <div class="brand">Verkehrszeichen Trainer</div>
        <div class="actions">
            <button class="ghost" on:click={toggleTheme} aria-label="Theme umschalten">{theme === 'dark' ? '🌙' : '☀️'}</button>
            <button class="ghost" on:click={() => showMenu = true} aria-label="Menü">☰</button>
        </div>
    </header>

    <main class="main">
        <section class="controls">
            <div class="mode-toggle" role="tablist" aria-label="Modus">
                <button role="tab" aria-selected={mode==='easy'} class:active={mode==='easy'} on:click={() => askSwitchMode('easy')}>Easy</button>
                <button role="tab" aria-selected={mode==='hard'} class:active={mode==='hard'} on:click={() => askSwitchMode('hard')}>Hard</button>
            </div>
            <div class="score">
                <span class="badge">Modus: {mode}</span>
                <span class="badge ok">Richtig: {correct}</span>
                <span class="badge bad">Falsch: {wrong}</span>
                <span class="badge">Verbleibend: {Math.max(SIGNS.length - (correct + wrong), 0)}</span>
            </div>
        </section>

        <section class="card-wrap">
            <div class="card" class:flip={isFlipping}>
                {#if finished}
                    <div class="card-face">
                        <h2>Fertig!</h2>
                        <p>Richtig: {correct} · Falsch: {wrong}</p>
                        <button on:click={startSession}>Neue Runde</button>
                    </div>
                {:else if current}
                    <div class="card-face">
                        <div class="card-media">
                            <div class="sign-box">
                                {#if imageReady}
                                    <div class="image-wrapper">
                                        <img class="sign" alt={current.title} src={current.src} />
                                    </div>
                                {:else}
                                    <div class="spinner" aria-label="Lädt"></div>
                                {/if}
                            </div>
                        </div>

                        <div class="card-content">
                            {#if mode === 'easy'}
                                <div class="choices">
                                    {#each options as opt}
                                        <button
                                            class="choice"
                                            class:correct={feedback==='correct' && opt===current.title}
                                            class:wrong={feedback==='wrong' && opt!==current.title && opt===opt}
                                            on:click={() => submitEasy(opt)} disabled={!!feedback}
                                        >{opt}</button>
                                    {/each}
                                </div>
                            {:else}
                                <form class="hard" on:submit|preventDefault={submitHard}>
                                    <input
                                        type="text"
                                        placeholder="Name des Zeichens"
                                        bind:value={hardInput}
                                        disabled={!!feedback}
                                        autocomplete="off"
                                    />
                                    <button type="submit" disabled={!!feedback}>Prüfen</button>
                                </form>
                            {/if}

                            {#if feedback}
                                <div class="feedback {feedback}">
                                    {#if feedback === 'correct'}Richtig!{/if}
                                    {#if feedback === 'wrong'}Falsch – {current.title}{/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </section>

        <nav class="nav">
            <button class="primary" on:click={next} disabled={finished || (!feedback && current !== null) || !imageReady}>{finished ? 'Fertig' : 'Weiter'}</button>
        </nav>

        <!-- Verlauf moved to modal -->
    </main>

    <footer class="footer">
        <small>
            Datengrundlage: Übersicht und Bedeutungen der Verkehrszeichen, siehe Quelle
            <a href="https://www.fuehrerscheine.de/verkehrsrecht/verkehrszeichen/" target="_blank" rel="noreferrer">Fuehrerscheine.de</a>
             | Made by Yamen Khalili, Source Code on <a href="https://github.com/Vierdant/verkehrszeichen_trainer" target="_blank" rel="noreferrer">GitHub</a>
        </small>
    </footer>
</div>

{#if showMenu}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-card">
      <header>
        <h3>Menü</h3>
      </header>
      <div class="modal-body">
        <div class="group">
          <div class="label">Modus wechseln</div>
          <div class="row">
            <button class:active={mode==='easy'} on:click={() => askSwitchMode('easy')}>Easy</button>
            <button class:active={mode==='hard'} on:click={() => askSwitchMode('hard')}>Hard</button>
          </div>
        </div>
        <div class="group">
          <button on:click={() => { showHistory = true; showMenu = false; }}>Verlauf ansehen</button>
        </div>
        <div class="group">
          <button on:click={toggleTheme}>Theme: {theme}</button>
        </div>
      </div>
      <footer>
        <button class="ghost" on:click={() => showMenu = false}>Schließen</button>
      </footer>
    </div>
  </div>
{/if}

{#if pendingMode}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-card">
      <header><h3>Modus ändern?</h3></header>
      <div class="modal-body">
        <p>Du wechselst zu "{pendingMode}". Die aktuelle Runde wird neu gestartet.</p>
      </div>
      <footer>
        <button class="ghost" on:click={cancelSwitchMode}>Abbrechen</button>
        <button class="primary" on:click={confirmSwitchMode}>Bestätigen</button>
      </footer>
    </div>
  </div>
{/if}

{#if showHistory}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-card">
      <header><h3>Verlauf</h3></header>
      <div class="modal-body">
        {#if history.length === 0}
          <p>Noch keine Einträge.</p>
        {:else}
          <ul class="history-list">
            {#each history as h}
              <li>
                <span>{new Date(h.timestamp).toLocaleString()}</span>
                <span>· Modus: {h.mode}</span>
                <span>· {h.correct}/{h.total} richtig</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <footer>
        <button class="primary" on:click={() => showHistory = false}>Schließen</button>
      </footer>
    </div>
  </div>
{/if}

<style>
    :global(:root[data-theme='dark']) {
        --bg: #0f1115;
        --card: #151923;
        --text: #e8eaf0;
        --muted: #9aa3b2;
        --accent: #4f8cff;
        --ok: #2fbf71;
        --bad: #ff5d5d;
        --border: #232838;
    }
    :global(:root[data-theme='light']) {
        --bg: #f6f7fb;
        --card: #ffffff;
        --text: #0f1115;
        --muted: #4a5568;
        --accent: #2563eb;
        --ok: #16a34a;
        --bad: #dc2626;
        --border: #e5e7eb;
    }


    :global(:root) {
        background: var(--bg); color: var(--text);
    }

    .app { min-height: 100dvh; display: flex; flex-direction: column; }
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .brand { font-weight: 700; font-size: 20px; }
    .actions .ghost { background: transparent; cursor: pointer; border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 10px; font-size: 16px; }

    .main { margin: 0 auto; width: min(920px, 100%); padding: 20px; display: grid; gap: 20px; }

    .controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .mode-toggle { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .mode-toggle > button { padding: 10px 14px; background: transparent; border: none; color: var(--text); cursor: pointer; font-weight: 600; }
    .mode-toggle > button.active { background: var(--accent); color: white; }
    .score { display: inline-flex; gap: 8px; color: var(--muted); align-items: center; flex-wrap: wrap; }
    .badge { border: 1px solid var(--border); padding: 4px 8px; border-radius: 999px; background: var(--card); color: var(--text); }
    .badge.ok { border-color: var(--ok); }
    .badge.bad { border-color: var(--bad); }

    .card-wrap { display: grid; place-items: center; padding: 8px; }
    .card { width: min(560px, 94vw); background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transform-style: preserve-3d; transition: transform 300ms cubic-bezier(.2,.8,.2,1); }
    .card.flip { transform: rotateY(180deg); }
    .card-face { display: grid; gap: 16px; justify-items: stretch; text-align: center; }
    .card-media { display: grid; place-items: center; }
    .card-content { display: grid; gap: 12px; justify-items: center; }
    .sign-box { width: min(420px, 80vw); height: min(420px, 60vh, 80vw); display: grid; place-items: center; background: transparent; overflow: visible; }
    .sign { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; object-position: center; image-rendering: -webkit-optimize-contrast; display: block; }

    .choices { display: grid; gap: 8px; width: 100%; }
    .choice { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; text-align: left; font-size: 16px; }
    .choice:hover { background: rgba(79,140,255,0.08); }
    .choice.correct { outline: 2px solid var(--ok); }
    .choice.wrong { outline: 2px solid var(--bad); }

    .hard { display: grid; grid-template-columns: 1fr auto; gap: 8px; width: 100%; }
    .hard input { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); font-size: 16px; }
    .hard button { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--accent); color: white; font-size: 16px; }

    .feedback { font-weight: 600; font-size: 16px; }
    .feedback.correct { color: var(--ok); }
    .feedback.wrong { color: var(--bad); }

    .nav { display: flex; justify-content: center; gap: 12px; }
    .nav .primary { padding: 14px 18px; border-radius: 12px; border: 1px solid var(--border); background: var(--accent); color: white; opacity: 1; transition: opacity 120ms ease; font-size: 16px; cursor: pointer; }
    .nav .primary:disabled { opacity: 0.5; cursor: not-allowed; }

    /* history list lives in modal */
    .footer { padding: 12px 16px; border-top: 1px solid var(--border); color: var(--muted); text-align: center; }

    /* Modal */
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 50; animation: fadeIn 150ms ease; }
    .modal-card { width: min(560px, 92vw); background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .modal-card > header, .modal-card > footer { padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .modal-card > footer { border-top: 1px solid var(--border); border-bottom: 0; display: flex; justify-content: flex-end; gap: 8px; }
    .modal-body { padding: 12px 16px; display: grid; gap: 12px; }
    .modal button { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); font-size: 16px; }
    .modal button.primary { background: var(--accent); color: white; }
    .modal button.active { outline: 2px solid var(--accent); }
    .group .label { font-weight: 600; margin-bottom: 6px; }
    .group .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .history-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; color: var(--muted); }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

    .ghost { cursor: pointer; }
    .primary { cursor: pointer; }

    .image-wrapper { width: 80%; height: 80%; display: grid; place-items: center; object-fit: contain; overflow: scroll; }

    /* Spinner */
    .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 900ms linear infinite; }
    @keyframes spin { to { transform: rotate(360deg) } }
</style>
