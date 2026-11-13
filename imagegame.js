/* One Piece Dle — shared engine for the picture games (Jolly Roger, Devil Fruit).
 * Each game calls makeImageGame(cfg) with its data and wording; this file handles the zoom-out image, search,
 * hints, Daily/Endless, saves, stats, streak and the end screen. Shared helpers come from app.js (OPDLE_API). */
window.makeImageGame = function (cfg) {
  "use strict";
  const A = window.OPDLE_API;
  const { load, save, esc, norm, seededShuffle, dayNumber, todayKey, settings, chapter } = A;
  const ID = cfg.id, $ = id => document.getElementById(ID + "-" + id);
  const view = document.getElementById(ID + "-view");

  view.innerHTML = `
    <section class="panel jr-panel">
      ${cfg.controlsHTML ? `<div class="ig-controls">${cfg.controlsHTML()}</div>` : ""}
      <div class="jr-frame" id="${ID}-frame"><img id="${ID}-img" referrerpolicy="no-referrer" alt="Mystery picture" draggable="false"></div>
      <p class="jr-zoom muted" id="${ID}-zoom"></p>
    </section>
    <section class="panel guess-panel">
      <div class="search">
        <input id="${ID}-input" type="text" autocomplete="off" spellcheck="false" aria-label="Your guess">
        <button id="${ID}-go" class="send" aria-label="Guess"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z" fill="currentColor"/></svg></button>
        <ul id="${ID}-sugg" class="suggestions" role="listbox"></ul>
      </div>
      <div class="guess-meta"><span id="${ID}-count">0 guesses</span><button id="${ID}-giveup" class="link-btn">Give up</button></div>
    </section>
    <section class="hints" id="${ID}-hints"></section>
    <section class="jr-guesses" id="${ID}-guesses"></section>`;

  // ---------- data ----------
  const pool = () => cfg.items.filter(it => cfg.chOf(it) <= chapter());
  const byId = id => cfg.items.find(it => it.id === id);
  function dailyTargetId(d = new Date()) {
    const order = seededShuffle(pool().map(it => it.id).sort(), cfg.seed);
    const day = dayNumber(d);
    return order[((day % order.length) + order.length) % order.length];
  }
  // Where the zoom is centred: fixed per puzzle so a reload doesn't move it
  function focusFor(id, salt) {
    let h = 2166136261; for (const ch of id + ":" + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const [lo, hi] = cfg.focusRange || [30, 70];
    return [lo + (h % (hi - lo + 1)), lo + ((h >>> 8) % (hi - lo + 1))];
  }

  // ---------- state ----------
  let mode = load(ID + ":mode", "daily") === "endless" ? "endless" : "daily";
  let game = null;
  function newGame(m) {
    mode = m; save(ID + ":mode", m);
    if (m === "daily") {
      const key = `${ID}:daily:${todayKey()}:${settings.spoiler}`;
      const saved = load(key, null);
      game = { key, target: dailyTargetId(), guesses: [], revealed: [false, false, false], done: false, won: false, salt: todayKey(), ...(saved || {}) };
    } else {
      const saved = load(ID + ":endless:current", null);
      if (saved && saved.spoiler === settings.spoiler && !saved.done && byId(saved.target)) game = { ...saved, key: ID + ":endless:current" };
      else {
        const p = pool();
        game = { key: ID + ":endless:current", target: p[Math.floor(Math.random() * p.length)].id, guesses: [], revealed: [false, false, false], done: false, won: false, salt: String(Date.now()) };
        persist();
      }
    }
    render();
  }
  function persist() { const { key, ...rest } = game; save(game.key, { ...rest, spoiler: settings.spoiler }); }

  // ---------- render ----------
  const input = $("input"), sugg = $("sugg"), img = $("img");
  let streakHold = false;
  function render(celebrate) {
    if (!A.isActive(ID)) return;
    const t = byId(game.target), n = game.guesses.length, Z = cfg.zoom;
    document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    document.getElementById("intro-title").textContent = cfg.introTitle(mode);
    document.getElementById("intro-sub").textContent = cfg.introSub(pool().length);
    document.getElementById("spoiler-pill").textContent = A.spoilerPillText();

    // Picture: a new picture is placed already zoomed in (no zoom animation) and stays hidden until it has loaded
    const step = game.done ? Z.length - 1 : Math.min(n, Z.length - 1);
    const [fx, fy] = focusFor(t.id, game.salt || "");
    const src = cfg.imgOf(t), puzzle = game.key + "|" + game.target + "|" + src;
    if (img.dataset.puzzle !== puzzle) {
      img.dataset.puzzle = puzzle;
      img.classList.add("instant", "loading");
      img.onload = img.onerror = () => { img.classList.remove("loading"); requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("instant"))); };
      img.style.transformOrigin = `${fx}% ${fy}%`;
      img.style.transform = `scale(${Z[step]})`;
      img.src = src;
    } else {
      img.style.transformOrigin = `${fx}% ${fy}%`;
      img.style.transform = `scale(${Z[step]})`;
    }
    $("frame").classList.toggle("solved", game.done);
    $("zoom").textContent = game.done ? (game.won ? `✅ ${cfg.nameOf(t)}` : `☠️ The answer: ${cfg.nameOf(t)}`)
      : step === Z.length - 1 ? "Fully zoomed out!" : `Zoom ${Z[step].toFixed(1)}× · zooms out with each wrong guess`;

    $("count").textContent = `${n} guess${n === 1 ? "" : "es"}`;
    $("giveup").classList.toggle("hidden", game.done);
    input.disabled = game.done; $("go").disabled = game.done;
    input.placeholder = game.done ? (mode === "daily" ? `Come back tomorrow for a new ${cfg.noun}!` : `Press New ${cfg.noun} to play again`) : cfg.placeholder();

    $("hints").innerHTML = cfg.hints.map((h, i) => {
      const unlocked = n >= h.at || game.done, shown = game.revealed[i] || game.done;
      const body = shown ? `<div class="reveal">${esc(h.get(t))}</div>`
        : unlocked ? `<button data-hint="${i}">Reveal hint</button>`
        : `<div class="lock">🔒 Unlocks in ${h.at - n} guess${h.at - n === 1 ? "" : "es"}</div>`;
      return `<div class="hint ${unlocked ? "" : "locked"}"><h4>Hint ${i + 1}: ${h.title}</h4>${body}</div>`;
    }).join("");

    $("guesses").innerHTML = [...game.guesses].reverse().map(id => {
      const it = byId(id), ok = id === game.target;
      return `<div class="jr-chip ${ok ? "ok" : ""}"><span>${ok ? "✅" : "❌"}</span><b>${esc(cfg.nameOf(it))}</b><small>${esc(cfg.subOf(it))}</small></div>`;
    }).join("");

    const y = new Date(); y.setDate(y.getDate() - 1);
    document.getElementById("yesterday").innerHTML = mode === "daily" ? `${cfg.yesterdayLabel}: <b>${esc(cfg.nameOf(byId(dailyTargetId(y))))}</b>` : "";
    if (!streakHold) A.renderStreak(celebrate, { mode, key: `stats:${ID}:daily` });
    if (cfg.afterRender) cfg.afterRender(view);
  }

  // ---------- search ----------
  let list = [], active = -1;
  function matches(q) {
    const nq = norm(q); if (!nq) return [];
    const guessed = new Set(game.guesses), out = [];
    for (const it of pool()) {
      if (guessed.has(it.id)) continue;
      let best = 99, via = null;
      cfg.namesFor(it).forEach((nm, i) => {
        const n = norm(nm); if (!n) return;
        const s = n.startsWith(nq) ? 0 : n.split(" ").some(w => w.startsWith(nq)) ? 1 : n.includes(nq) ? 2 : 99;
        if (s < best) { best = s; via = i === 0 ? null : nm; }
      });
      if (best < 99) out.push({ it, best, via });
    }
    return out.sort((a, b) => a.best - b.best || cfg.nameOf(a.it).localeCompare(cfg.nameOf(b.it))).slice(0, 8);
  }
  function showSuggestions() {
    list = matches(input.value); active = list.length ? 0 : -1;
    sugg.innerHTML = list.map((m, i) => `<li data-i="${i}" class="${i === active ? "active" : ""}">
      <span class="jr-flag-ico">${cfg.icon}</span><div><div>${esc(cfg.nameOf(m.it))}</div><div class="alias">${esc(cfg.suggestSub(m.it, m.via))}</div></div></li>`).join("");
    sugg.classList.toggle("open", list.length > 0);
  }
  const closeSugg = () => { sugg.classList.remove("open"); list = []; active = -1; };
  function setActive(i) { active = i; sugg.querySelectorAll("li").forEach((li, k) => li.classList.toggle("active", k === i)); }

  function submit(id) {
    if (game.done) return;
    if (!id) {
      if (active >= 0 && list[active]) id = list[active].it.id;
      else {
        const nq = norm(input.value);
        const exact = pool().find(it => cfg.namesFor(it).some(n => norm(n) === nq));
        if (!exact) { A.toast(cfg.pickToast); return; }
        id = exact.id;
      }
    }
    if (game.guesses.includes(id)) { A.toast("Already guessed!"); return; }
    game.guesses.push(id);
    input.value = ""; closeSugg();
    const won = id === game.target;
    if (won) { game.done = true; game.won = true; record(true); streakHold = true; }
    persist(); render();
    if (won) setTimeout(() => { streakHold = false; render(true); showEnd(); }, 900);
  }
  function giveUp() {
    if (game.done) return;
    game.done = true; game.won = false; persist(); record(false); render(); showEnd();
  }
  function record(won) {
    const key = `stats:${ID}:${mode}`;
    const s = load(key, { played: 0, wins: 0, streak: 0, best: 0, totalGuesses: 0, lastDay: null });
    s.played++;
    if (won) {
      s.wins++; s.totalGuesses += game.guesses.length;
      if (mode === "daily") { const today = dayNumber(); s.streak = s.lastDay === today ? s.streak : (s.lastDay === today - 1 ? s.streak + 1 : 1); s.lastDay = today; }
      else s.streak++;
      s.best = Math.max(s.best, s.streak);
    } else s.streak = 0;
    save(key, s);
  }

  // ---------- end screen ----------
  let timer = null;
  function shareText() {
    const marks = game.guesses.map(id => id === game.target ? cfg.icon : "🟥").join("");
    const title = `One Piece Dle ${cfg.shareName} — ${mode === "daily" ? todayKey() : "Endless"}`;
    return `${title} (${SPOILER_LEVELS[settings.spoiler].short}${cfg.shareExtra ? cfg.shareExtra() : ""})\n${game.won ? `Found in ${game.guesses.length}` : "Gave up ☠️"}\n${marks}`;
  }
  function showEnd() {
    const t = byId(game.target), n = game.guesses.length;
    A.openModal(`
      <h2>${game.won ? (n === 1 ? "First try!" : "Victory!") : `The ${cfg.noun} was…`}</h2>
      <div class="jr-end"><img src="${esc(cfg.imgOf(t))}" referrerpolicy="no-referrer" alt=""><div class="nm">${esc(cfg.nameOf(t))}</div>
        <div class="ep">${esc(cfg.endDetail(t))}</div></div>
      <p style="text-align:center">${game.won ? `You got it in <b>${n}</b> guess${n === 1 ? "" : "es"}.` : "Better luck next round!"}</p>
      ${mode === "daily" ? `<p class="muted" style="text-align:center">Next ${cfg.noun} in</p><div class="countdown" id="${ID}-countdown"></div>` : ""}
      <div class="btn-row">
        <button class="btn secondary" id="${ID}-share">Copy result</button>
        ${mode === "endless" ? `<button class="btn" id="${ID}-next">New ${cfg.noun}</button>` : `<button class="btn" id="${ID}-to-endless">Play Endless</button>`}
      </div>`);
    $("share").onclick = () => A.copy(shareText());
    if ($("next")) $("next").onclick = () => { A.closeModal(); save(ID + ":endless:current", null); newGame("endless"); input.focus(); };
    if ($("to-endless")) $("to-endless").onclick = () => { A.closeModal(); newGame("endless"); };
    clearInterval(timer);
    if (mode === "daily") {
      const tick = () => {
        const el = $("countdown"); if (!el) { clearInterval(timer); return; }
        const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((next - now) / 1000));
        el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, "0")).join(":");
      };
      tick(); timer = setInterval(tick, 1000);
    }
  }

  // ---------- events ----------
  input.addEventListener("input", showSuggestions);
  input.addEventListener("focus", () => input.value && showSuggestions());
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && list.length) { e.preventDefault(); setActive((active + 1) % list.length); }
    else if (e.key === "ArrowUp" && list.length) { e.preventDefault(); setActive((active - 1 + list.length) % list.length); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") closeSugg();
  });
  sugg.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); submit(list[+li.dataset.i].it.id); } });
  document.addEventListener("click", e => { if (!e.target.closest(`#${ID}-view .search`)) closeSugg(); });
  $("go").onclick = () => submit();
  $("giveup").onclick = giveUp;
  $("hints").addEventListener("click", e => { const b = e.target.closest("button[data-hint]"); if (b) { game.revealed[+b.dataset.hint] = true; persist(); render(); } });
  if (cfg.onMount) cfg.onMount(view, () => { closeSugg(); render(); });

  newGame(mode);
  A.register(ID, {
    label: cfg.label,
    show: () => render(),
    setMode: m => { if (m !== mode) newGame(m); },
    onSpoilerChange: () => { save(ID + ":endless:current", null); newGame(mode); },
    helpHTML: cfg.helpHTML,
  });
  return { pool, dailyTargetId, matches, byId, get game() { return game; } };
};
