/* One Piece Dle — Jolly Roger game. Data lives in flags.js, shared helpers come from app.js (OPDLE_API). */
(() => {
  "use strict";
  const A = window.OPDLE_API;
  if (!A || typeof FLAGS === "undefined") return;
  const { load, save, esc, norm, seededShuffle, dayNumber, todayKey, settings, chapter } = A;
  const $ = id => document.getElementById(id);

  const SEED = 77100429;                       // daily order for this game (change to reshuffle)
  const ZOOM = [4.2, 3.2, 2.5, 2.0, 1.6, 1.3, 1.1, 1];   // zoom per wrong guess (last = full flag)
  const HINTS = [
    { at: 3, title: "First appearance", get: f => `Chapter ${f.ch} · ${ARCS[A.arcIndex(f.ch)][0]} arc` },
    { at: 6, title: "Type",             get: f => kindAt(f) },
    { at: 9, title: "Captain's initials", get: f => initialsOf(f.captains[0]) },
  ];

  // ---------- data helpers ----------
  const charByName = new Map(CHARACTERS.map(c => [c.name, c]));
  const kindAt = f => { let k = f.kind; (f.kindEarly || []).slice().sort((a, b) => b[0] - a[0]).forEach(([u, v]) => { if (chapter() < u) k = v; }); return k; };
  const imgAt = f => { let u = f.img; (f.imgEarly || []).slice().sort((a, b) => b[0] - a[0]).forEach(([c, v]) => { if (chapter() < c) u = v; }); return u; };
  const initialsOf = name => name.replace(/^Saint\s+/, "").split(/\s+/).map(w => w[0].toUpperCase() + ".").join(" ");
  // Every name that counts as correct for a flag: its name, extra answers, captains and their aliases from characters.js
  const namesFor = f => {
    const out = [f.name, ...(f.answers || [])];
    for (const cap of f.captains) { out.push(cap); const c = charByName.get(cap); if (c) out.push(...c.aliases); }
    return out;
  };
  const pool = () => FLAGS.filter(f => f.ch <= chapter());
  const byId = id => FLAGS.find(f => f.id === id);

  function dailyTargetId(d = new Date()) {
    const ids = pool().map(f => f.id).sort();
    const order = seededShuffle(ids, SEED);
    const day = dayNumber(d);
    return order[((day % order.length) + order.length) % order.length];
  }
  // Where the zoom is centred: fixed per puzzle so a reload doesn't move it
  function focusFor(id, salt) {
    let h = 2166136261; for (const ch of id + ":" + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return [30 + (h % 41), 30 + ((h >>> 8) % 41)];
  }

  // ---------- state ----------
  let mode = load("flags:mode", "daily") === "endless" ? "endless" : "daily";
  let game = null;
  function newGame(m) {
    mode = m; save("flags:mode", m);
    if (m === "daily") {
      const key = `flags:daily:${todayKey()}:${settings.spoiler}`;
      const saved = load(key, null);
      game = { key, target: dailyTargetId(), guesses: [], revealed: [false, false, false], done: false, won: false, salt: todayKey(), ...(saved || {}) };
    } else {
      const saved = load("flags:endless:current", null);
      if (saved && saved.spoiler === settings.spoiler && !saved.done && byId(saved.target)) game = { ...saved, key: "flags:endless:current" };
      else {
        const p = pool();
        game = { key: "flags:endless:current", target: p[Math.floor(Math.random() * p.length)].id, guesses: [], revealed: [false, false, false], done: false, won: false, salt: String(Date.now()) };
        persist();
      }
    }
    render();
  }
  function persist() { const { key, ...rest } = game; save(game.key, { ...rest, spoiler: settings.spoiler }); }

  // ---------- render ----------
  const input = $("jr-input"), sugg = $("jr-suggestions");
  function render(celebrate) {
    if (!A.isActive("flags")) return;
    const t = byId(game.target), n = game.guesses.length;
    document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    $("intro-title").textContent = mode === "daily" ? "Guess today's Jolly Roger!" : "Endless mode — guess a random Jolly Roger!";
    $("intro-sub").textContent = `${pool().length} flags in the pool. Type the crew or its captain. The flag zooms out with every wrong guess.`;
    $("spoiler-pill").textContent = A.spoilerPillText();

    // image + zoom
    const img = $("jr-img"), step = game.done ? ZOOM.length - 1 : Math.min(n, ZOOM.length - 1);
    const [fx, fy] = focusFor(t.id, game.salt || "");
    if (img.dataset.src !== imgAt(t)) { img.dataset.src = imgAt(t); img.src = imgAt(t); }
    img.style.transformOrigin = `${fx}% ${fy}%`;
    img.style.transform = `scale(${ZOOM[step]})`;
    $("jr-frame").classList.toggle("solved", game.done);
    $("jr-zoom").textContent = game.done ? (game.won ? `✅ ${t.name}` : `☠️ The answer: ${t.name}`)
      : step === ZOOM.length - 1 ? "Fully zoomed out!" : `Zoom ${ZOOM[step].toFixed(1)}× · zooms out with each wrong guess`;

    $("jr-count").textContent = `${n} guess${n === 1 ? "" : "es"}`;
    $("jr-giveup").classList.toggle("hidden", game.done);
    input.disabled = game.done; $("jr-guess-btn").disabled = game.done;
    input.placeholder = game.done ? (mode === "daily" ? "Come back tomorrow for a new flag!" : "Press New flag to play again") : "Crew or captain name…";

    // hints
    $("jr-hints").innerHTML = HINTS.map((h, i) => {
      const unlocked = n >= h.at || game.done, shown = game.revealed[i] || game.done;
      const body = shown ? `<div class="reveal">${esc(h.get(t))}</div>`
        : unlocked ? `<button data-hint="${i}">Reveal hint</button>`
        : `<div class="lock">🔒 Unlocks in ${h.at - n} guess${h.at - n === 1 ? "" : "es"}</div>`;
      return `<div class="hint ${unlocked ? "" : "locked"}"><h4>Hint ${i + 1}: ${h.title}</h4>${body}</div>`;
    }).join("");

    // guesses (newest first)
    $("jr-guesses").innerHTML = [...game.guesses].reverse().map(id => {
      const f = byId(id), ok = id === game.target;
      return `<div class="jr-chip ${ok ? "ok" : ""}"><span>${ok ? "✅" : "❌"}</span><b>${esc(f.name)}</b><small>${esc(f.captains.join(" / "))}</small></div>`;
    }).join("");

    // yesterday + streak
    const y = new Date(); y.setDate(y.getDate() - 1);
    $("yesterday").innerHTML = mode === "daily" ? `Yesterday's Jolly Roger: <b>${esc(byId(dailyTargetId(y)).name)}</b>` : "";
    if (!streakHold) A.renderStreak(celebrate, { mode, key: "stats:flags:daily" });
  }

  // ---------- search ----------
  let list = [], active = -1;
  function matches(q) {
    const nq = norm(q); if (!nq) return [];
    const guessed = new Set(game.guesses), out = [];
    for (const f of pool()) {
      if (guessed.has(f.id)) continue;
      let best = 99, via = null;
      namesFor(f).forEach((nm, i) => {
        const n = norm(nm); if (!n) return;
        const s = n.startsWith(nq) ? 0 : n.split(" ").some(w => w.startsWith(nq)) ? 1 : n.includes(nq) ? 2 : 99;
        if (s < best) { best = s; via = i === 0 ? null : nm; }
      });
      if (best < 99) out.push({ f, best, via });
    }
    return out.sort((a, b) => a.best - b.best || a.f.name.localeCompare(b.f.name)).slice(0, 8);
  }
  function showSuggestions() {
    list = matches(input.value); active = list.length ? 0 : -1;
    sugg.innerHTML = list.map((m, i) => `<li data-i="${i}" class="${i === active ? "active" : ""}">
      <span class="jr-flag-ico">🏴‍☠️</span><div><div>${esc(m.f.name)}</div><div class="alias">${esc(m.via && !m.f.captains.includes(m.via) ? m.via + " · " : "")}Captain: ${esc(m.f.captains.join(" / "))}</div></div></li>`).join("");
    sugg.classList.toggle("open", list.length > 0);
  }
  const closeSugg = () => { sugg.classList.remove("open"); list = []; active = -1; };
  function setActive(i) { active = i; sugg.querySelectorAll("li").forEach((li, k) => li.classList.toggle("active", k === i)); }

  let streakHold = false;
  function submit(id) {
    if (game.done) return;
    if (!id) {
      if (active >= 0 && list[active]) id = list[active].f.id;
      else {
        const nq = norm(input.value);
        const exact = pool().find(f => namesFor(f).some(n => norm(n) === nq));
        if (!exact) { A.toast("Pick a crew or captain from the list"); return; }
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
    const key = `stats:flags:${mode}`;
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
    const marks = game.guesses.map(id => id === game.target ? "🏴‍☠️" : "🟥").join("");
    const title = mode === "daily" ? `One Piece Dle Jolly Roger — ${todayKey()}` : "One Piece Dle Jolly Roger — Endless";
    return `${title} (${SPOILER_LEVELS[settings.spoiler].short})\n${game.won ? `Found in ${game.guesses.length}` : "Gave up ☠️"}\n${marks}`;
  }
  function showEnd() {
    const t = byId(game.target), n = game.guesses.length;
    A.openModal(`
      <h2>${game.won ? (n === 1 ? "First try!" : "Victory!") : "The flag was…"}</h2>
      <div class="jr-end"><img src="${esc(imgAt(t))}" alt=""><div class="nm">${esc(t.name)}</div>
        <div class="ep">Captain: ${esc(t.captains.join(" / "))} · ${esc(kindAt(t))}</div></div>
      <p style="text-align:center">${game.won ? `You got it in <b>${n}</b> guess${n === 1 ? "" : "es"}.` : "Better luck next round!"}</p>
      ${mode === "daily" ? `<p class="muted" style="text-align:center">Next flag in</p><div class="countdown" id="jr-countdown"></div>` : ""}
      <div class="btn-row">
        <button class="btn secondary" id="jr-share">Copy result</button>
        ${mode === "endless" ? `<button class="btn" id="jr-next">New flag</button>` : `<button class="btn" id="jr-to-endless">Play Endless</button>`}
      </div>`);
    $("jr-share").onclick = () => A.copy(shareText());
    if ($("jr-next")) $("jr-next").onclick = () => { A.closeModal(); save("flags:endless:current", null); newGame("endless"); input.focus(); };
    if ($("jr-to-endless")) $("jr-to-endless").onclick = () => { A.closeModal(); newGame("endless"); };
    clearInterval(timer);
    if (mode === "daily") {
      const tick = () => {
        const el = $("jr-countdown"); if (!el) { clearInterval(timer); return; }
        const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((next - now) / 1000));
        el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, "0")).join(":");
      };
      tick(); timer = setInterval(tick, 1000);
    }
  }

  const helpHTML = () => `<h2>How to play: Jolly Roger</h2>
    <p>Name the crew that flies this Jolly Roger. You can type the <b>crew</b> (Heart Pirates) or its <b>captain</b> (Law). Personal flags, like the ones Oda drew for each Straw Hat, are answered with that person's name.</p>
    <ul>
      <li>The flag starts zoomed in and <b>zooms out with every wrong guess</b>.</li>
      <li>Hints unlock after ${HINTS.map(h => `${h.at} (${h.title.toLowerCase()})`).join(", ")} guesses.</li>
      <li>Guesses are unlimited, and you can give up at any time.</li>
    </ul>
    <p><b>Daily</b>: one flag per day, the same for everyone on this spoiler level. <b>Endless</b>: random flags, back to back.</p>
    <p class="muted">Flag images from the One Piece Wiki.</p>`;

  // ---------- events ----------
  input.addEventListener("input", showSuggestions);
  input.addEventListener("focus", () => input.value && showSuggestions());
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && list.length) { e.preventDefault(); setActive((active + 1) % list.length); }
    else if (e.key === "ArrowUp" && list.length) { e.preventDefault(); setActive((active - 1 + list.length) % list.length); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") closeSugg();
  });
  sugg.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); submit(list[+li.dataset.i].f.id); } });
  document.addEventListener("click", e => { if (!e.target.closest("#flag-view .search")) closeSugg(); });
  $("jr-guess-btn").onclick = () => submit();
  $("jr-giveup").onclick = giveUp;
  $("jr-hints").addEventListener("click", e => { const b = e.target.closest("button[data-hint]"); if (b) { game.revealed[+b.dataset.hint] = true; persist(); render(); } });

  newGame(mode);
  A.register({
    show: () => render(),
    setMode: m => { if (m !== mode) newGame(m); },
    onSpoilerChange: () => { save("flags:endless:current", null); newGame(mode); },
    helpHTML,
  });
  window.OPDLE_FLAGS = { pool, dailyTargetId, matches, namesFor, byId };
})();
