/* One Piece Dle — game logic. Data lives in characters.js */
(() => {
  "use strict";

  // ---------- constants ----------
  const HINTS = [
    { at: 4,  title: "Epithet",        get: c => c.epithet || "No known epithet" },
    { at: 7,  title: "Devil Fruit",    get: c => c.fruit.type.length === 0 ? "Hasn't eaten a Devil Fruit" : c.fruit.name },
    { at: 10, title: "Clue",           get: c => c.clue },
  ];
  const HAKI_NAMES = { O: "Observation", A: "Armament", C: "Conqueror's" };
  const HAKI_EMOJI = { O: "👁️", A: "💪", C: "👑" };
  const STORE = "opdle:";
  const DAILY_SEED = 20260412; // change to reshuffle the daily order

  // ---------- storage helpers ----------
  const load = (k, d) => { try { const v = localStorage.getItem(STORE + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(STORE + k, JSON.stringify(v)); } catch {} };

  // ---------- data helpers ----------
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const arcIndex = ch => { let i = 0; ARCS.forEach(([, start], k) => { if (ch >= start) i = k; }); return i; };

  /** Character stats as of a chapter cutoff (applies `changes`). */
  function statsAt(c, chapter) {
    const s = { ...c, fruit: { ...c.fruit, type: [...c.fruit.type] } };
    (c.changes || []).filter(x => x.ch <= chapter).sort((a, b) => a.ch - b.ch).forEach(x => {
      for (const [k, v] of Object.entries(x)) if (k !== "ch") s[k] = (k === "fruit") ? { ...v } : v;
    });
    // House rule: anyone with Conqueror's Haki is treated as having all three types.
    if (s.haki.includes("C")) s.haki = "OAC";
    s.arc = arcIndex(s.debut);
    return s;
  }

  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let t = seed >>> 0;
    const rnd = () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

  // ---------- formatting ----------
  function fmtBounty(b) {
    if (b === null || b === undefined) return "Unknown";
    if (b >= 1e9) return "฿" + (+(b / 1e9).toFixed(3)).toString() + "B";
    if (b >= 1e6) return "฿" + (+(b / 1e6).toFixed(1)).toString() + "M";
    return "฿" + b.toLocaleString("en-US");
  }
  const fmtHeight = cm => (cm === null || cm === undefined) ? "Unknown" : `${Math.floor(cm / 100)}m${String(cm % 100).padStart(2, "0")}`;
  const fmtFruit = t => t.length ? t.join(" + ") : "None";
  const initials = name => name.replace(/["'.]/g, "").split(/\s+/).filter(w => !/^d$/i.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  function colorFor(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 55% 42%)`; }
  // Portraits are loaded straight from the One Piece Wiki ("<Page> Portrait.png").
  // If that fails we try the anime infobox image, then fall back to initials.
  // MediaWiki stores files at /images/<md5[0]>/<md5[0..1]>/<File_Name>, so we can build the
  // direct CDN link ourselves (no redirect page needed, which Fandom blocks for local files).
  function md5(str) {
    const k = [], s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const bytes = Array.from(new TextEncoder().encode(str));
    const bitLen = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 0; i < 8; i++) bytes.push(i < 4 ? (bitLen >>> (8 * i)) & 255 : 0);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let off = 0; off < bytes.length; off += 64) {
      const m = []; for (let i = 0; i < 16; i++) m[i] = bytes[off+4*i] | (bytes[off+4*i+1] << 8) | (bytes[off+4*i+2] << 16) | (bytes[off+4*i+3] << 24);
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const tmp = d; d = c; c = b;
        const x = (a + f + k[i] + m[g]) | 0;
        b = (b + ((x << s[i]) | (x >>> (32 - s[i])))) | 0; a = tmp;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    return [a0, b0, c0, d0].map(v => Array.from({ length: 4 }, (_, i) => ((v >>> (8 * i)) & 255).toString(16).padStart(2, "0")).join("")).join("");
  }
  const WIKI_FILE = f => {
    const name = f.replace(/ /g, "_"), h = md5(name);
    return `https://static.wikia.nocookie.net/onepiece/images/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}/revision/latest/scale-to-width-down/120`;
  };
  const charByName = new Map(CHARACTERS.map(c => [c.name, c]));
  function portraitSources(name) {
    const c = charByName.get(name) || {};
    const page = c.wiki || name;
    const list = [];
    if (c.img) list.push(c.img);
    list.push(WIKI_FILE(`${page} Portrait.png`), WIKI_FILE(`${page} Anime Infobox.png`));
    return list;
  }
  window.__opdleImgFail = img => {
    const rest = (img.dataset.rest || "").split("|").filter(Boolean);
    if (rest.length) { img.dataset.rest = rest.slice(1).join("|"); img.src = rest[0]; }
    else img.remove();
  };
  const avatar = name => {
    const [first, ...rest] = portraitSources(name);
    return `<span class="avatar" style="background:${colorFor(name)}">${initials(name)}` +
      `<img src="${esc(first)}" data-rest="${esc(rest.join("|"))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="__opdleImgFail(this)"></span>`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // ---------- comparison ----------
  function setCompare(a, b) {
    const A = new Set(a), B = new Set(b);
    if (A.size === B.size && [...A].every(x => B.has(x))) return "correct";
    if ([...A].some(x => B.has(x))) return "partial";
    return "wrong";
  }
  function numCompare(g, t) {
    if (g === t) return { status: "correct" };
    if (g === null || t === null) return { status: "wrong" };
    return { status: "wrong", arrow: t > g ? "up" : "down" };
  }

  function compare(g, t) {
    const hakiG = g.haki.split(""), hakiT = t.haki.split("");
    return [
      { status: g.gender === t.gender ? "correct" : "wrong", text: g.gender },
      { status: g.aff[0] === t.aff[0] ? "correct" : (g.aff.some(x => t.aff.includes(x)) ? "partial" : "wrong"),
        text: g.aff[0], cls: g.aff[0].length > 16 ? "tiny" : "small", title: g.aff.join(", ") },
      { status: setCompare(g.fruit.type, t.fruit.type), text: fmtFruit(g.fruit.type), cls: g.fruit.type.length > 1 ? "small" : "" },
      { status: setCompare(hakiG, hakiT),
        html: hakiG.length ? `<div class="haki">${hakiG.map(h => `<span title="${HAKI_NAMES[h]}">${HAKI_EMOJI[h]}</span>`).join("")}</div>` : "None",
        title: hakiG.length ? hakiG.map(h => HAKI_NAMES[h]).join(", ") : "No Haki" },
      { ...numCompare(g.bounty, t.bounty), text: fmtBounty(g.bounty), cls: "small" },
      { ...numCompare(g.height, t.height), text: fmtHeight(g.height) },
      { status: g.origin === t.origin ? "correct" : "wrong", text: g.origin, cls: "small" },
      { ...numCompare(g.arc, t.arc), text: ARCS[g.arc][0], cls: ARCS[g.arc][0].length > 12 ? "tiny" : "small" },
    ];
  }

  // ---------- state ----------
  const settings = { spoiler: load("spoiler", "egghead") };
  if (!SPOILER_LEVELS[settings.spoiler]) settings.spoiler = "egghead";
  let mode = load("mode", "daily");
  let game = null; // { mode, target, guesses[], revealed[], done, won }

  const chapter = () => SPOILER_LEVELS[settings.spoiler].chapter;
  const pool = () => CHARACTERS.filter(c => (c.reveal || c.debut) <= chapter()).map(c => statsAt(c, chapter()));
  const byName = name => pool().find(c => c.name === name);

  function dailyTargetName(d = new Date()) {
    // Characters with an `added` date only join the daily rotation the day AFTER they were added,
    // so adding characters mid-day never changes that day's answer.
    const today = dayNumber(d);
    const addedDay = s => { const [y, m, dd] = s.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, dd) / 86400000); };
    const names = CHARACTERS
      .filter(c => (c.reveal || c.debut) <= chapter() && (!c.added || addedDay(c.added) < today))
      .map(c => c.name).sort();
    const order = seededShuffle(names, DAILY_SEED);
    return order[((dayNumber(d) % order.length) + order.length) % order.length];
  }

  function newGame(m) {
    mode = m; save("mode", m);
    if (m === "daily") {
      const key = `daily:${todayKey()}:${settings.spoiler}`;
      const saved = load(key, null);
      game = { mode: m, key, target: dailyTargetName(), guesses: [], revealed: [false, false, false], done: false, won: false, ...(saved || {}) };
    } else {
      const saved = load("endless:current", null);
      if (saved && saved.spoiler === settings.spoiler && !saved.done && byName(saved.target)) {
        game = { ...saved, mode: m, key: "endless:current" };
      } else {
        const p = pool();
        game = { mode: m, key: "endless:current", spoiler: settings.spoiler, target: p[Math.floor(Math.random() * p.length)].name, guesses: [], revealed: [false, false, false], done: false, won: false };
        persist();
      }
    }
    render(true);
  }

  function persist() {
    const { mode: _m, key, ...rest } = game;
    save(key, { ...rest, spoiler: settings.spoiler });
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const input = $("guess-input"), sugg = $("suggestions"), rowsEl = $("rows");
  let activeIdx = -1, currentList = [];

  function render(full) {
    document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    const lvl = SPOILER_LEVELS[settings.spoiler];
    $("intro-title").textContent = mode === "daily" ? "Guess today's One Piece character!" : "Endless mode — guess a random character!";
    $("intro-sub").textContent = `${pool().length} characters in the pool. Hints unlock at ${HINTS.map(h => h.at).join(", ")} guesses.`;
    $("spoiler-pill").textContent = `Spoilers: ${lvl.label} · ${lvl.note}`;
    $("guess-count").textContent = `${game.guesses.length} guess${game.guesses.length === 1 ? "" : "es"}`;
    $("giveup-btn").classList.toggle("hidden", mode !== "endless" || game.done);
    input.disabled = game.done; $("guess-btn").disabled = game.done;
    input.placeholder = game.done ? (mode === "daily" ? "Come back tomorrow for a new character!" : "Press New character to play again") : "Character name, alias, epithet…";
    renderHints();
    if (full) { rowsEl.innerHTML = ""; [...game.guesses].reverse().forEach(n => rowsEl.appendChild(buildRow(n, false))); }
    renderYesterday();
  }

  function buildRow(name, animate) {
    const g = byName(name), t = byName(game.target);
    const row = document.createElement("div");
    row.className = "row";
    const charCell = document.createElement("div");
    charCell.className = "cell char show" + (name === game.target ? " win" : "");
    charCell.innerHTML = `${avatar(g.name)}<span class="nm">${esc(g.name)}</span>`;
    row.appendChild(charCell);
    compare(g, t).forEach((r, i) => {
      const d = document.createElement("div");
      d.className = `cell ${r.status} ${r.cls || ""}`;
      if (r.title) d.title = r.title;
      d.innerHTML = (r.arrow ? `<span class="arrow">${r.arrow === "up" ? "▲" : "▼"}</span>` : "") + `<span class="v">${r.html || esc(r.text)}</span>`;
      if (animate) { d.style.animationDelay = `${i * 0.28}s`; requestAnimationFrame(() => d.classList.add("show")); }
      else d.classList.add("show");
      row.appendChild(d);
    });
    return row;
  }

  function renderHints() {
    const t = byName(game.target), n = game.guesses.length;
    $("hints").innerHTML = HINTS.map((h, i) => {
      const unlocked = n >= h.at || game.done;
      const shown = game.revealed[i] || game.done;
      let body;
      if (shown) body = `<div class="reveal">${esc(h.get(t))}</div>`;
      else if (unlocked) body = `<button data-hint="${i}">Reveal hint</button>`;
      else body = `<div class="lock">🔒 Unlocks in ${h.at - n} guess${h.at - n === 1 ? "" : "es"}</div>`;
      return `<div class="hint ${unlocked ? "" : "locked"}"><h4>Hint ${i + 1}: ${h.title}</h4>${body}</div>`;
    }).join("");
  }

  function renderYesterday() {
    const el = $("yesterday");
    if (mode !== "daily") { el.textContent = ""; return; }
    const y = new Date(); y.setDate(y.getDate() - 1);
    el.innerHTML = `Yesterday's character was <b>${esc(dailyTargetName(y))}</b>`;
  }

  // ---------- search / suggestions ----------
  function matches(q) {
    const nq = norm(q);
    if (!nq) return [];
    const guessed = new Set(game.guesses);
    const out = [];
    for (const c of pool()) {
      if (guessed.has(c.name)) continue;
      const names = [c.name, ...c.aliases, (c.epithet || "").replace(/^.*?"|".*$/g, "")];
      let best = 99, via = null;
      names.forEach((nm, i) => {
        const n = norm(nm); if (!n) return;
        const words = n.split(" ");
        let score = n.startsWith(nq) ? 0 : words.some(w => w.startsWith(nq)) ? 1 : n.includes(nq) ? 2 : 99;
        if (score < best || (score === best && i === 0)) { best = score; via = i === 0 ? null : nm; }
      });
      if (best < 99) out.push({ c, best, via });
    }
    return out.sort((a, b) => a.best - b.best || a.c.name.localeCompare(b.c.name)).slice(0, 8);
  }

  function showSuggestions() {
    currentList = matches(input.value);
    activeIdx = currentList.length ? 0 : -1;
    sugg.innerHTML = currentList.map((m, i) =>
      `<li role="option" data-i="${i}" class="${i === activeIdx ? "active" : ""}">${avatar(m.c.name)}<div><div>${esc(m.c.name)}</div>${m.via ? `<div class="alias">${esc(m.via)}</div>` : ""}</div></li>`).join("");
    sugg.classList.toggle("open", currentList.length > 0);
  }
  function setActive(i) {
    activeIdx = i;
    [...sugg.children].forEach((li, k) => li.classList.toggle("active", k === i));
    sugg.children[i]?.scrollIntoView({ block: "nearest" });
  }
  function closeSuggestions() { sugg.classList.remove("open"); currentList = []; activeIdx = -1; }

  function submit(name) {
    if (game.done) return;
    if (!name) {
      if (activeIdx >= 0 && currentList[activeIdx]) name = currentList[activeIdx].c.name;
      else {
        const nq = norm(input.value);
        const exact = pool().find(c => norm(c.name) === nq || c.aliases.some(a => norm(a) === nq));
        if (!exact) { toast("Pick a character from the list"); return; }
        name = exact.name;
      }
    }
    if (game.guesses.includes(name)) { toast("Already guessed!"); return; }
    game.guesses.push(name);
    input.value = ""; closeSuggestions();
    rowsEl.prepend(buildRow(name, true));
    const won = name === game.target;
    if (won) { game.done = true; game.won = true; recordResult(true); }
    persist();
    render(false);
    if (won) setTimeout(() => showWin(), 2600);
  }

  function giveUp() {
    if (game.done) return;
    game.done = true; game.won = false; persist(); recordResult(false); render(false); showWin();
  }

  // ---------- stats ----------
  function recordResult(won) {
    const key = `stats:${mode}`;
    const s = load(key, { played: 0, wins: 0, streak: 0, best: 0, totalGuesses: 0, lastDay: null });
    s.played++;
    if (won) {
      s.wins++; s.totalGuesses += game.guesses.length;
      if (mode === "daily") {
        const today = dayNumber();
        s.streak = (s.lastDay === today - 1) ? s.streak + 1 : 1;
        s.lastDay = today;
      } else s.streak++;
      s.best = Math.max(s.best, s.streak);
    } else s.streak = 0;
    save(key, s);
  }

  // ---------- modals ----------
  function openModal(html) { $("modal-body").innerHTML = html; $("modal-bg").classList.remove("hidden"); }
  let modalLocked = false;   // true while the first-visit spoiler picker is open (must pick to continue)
  function closeModal() { if (modalLocked) return; $("modal-bg").classList.add("hidden"); $("modal-close").classList.remove("hidden"); clearInterval(countdownTimer); }
  let countdownTimer = null;

  function shareText() {
    const t = byName(game.target);
    const map = { correct: "🟩", partial: "🟨", wrong: "🟥" };
    const lines = game.guesses.map(n => compare(byName(n), t).map(r => map[r.status]).join(""));
    const title = mode === "daily" ? `One Piece Dle — ${todayKey()}` : "One Piece Dle — Endless";
    return `${title} (${SPOILER_LEVELS[settings.spoiler].short})\n${game.won ? `Found in ${game.guesses.length} 🏴‍☠️` : "Gave up ☠️"}\n${lines.join("\n")}`;
  }

  function showWin() {
    const t = byName(game.target);
    const headline = game.won ? `${game.guesses.length === 1 ? "First try!" : "Victory!"}` : "The answer was…";
    openModal(`
      <h2>${headline}</h2>
      <div class="win-card">${avatar(t.name)}<div>
        <div class="nm">${esc(t.name)}</div>
        <div class="ep">${esc(t.epithet)}</div>
        <div class="ep">${esc(t.aff[0])} · ${fmtBounty(t.bounty)} · ${fmtHeight(t.height)}</div>
      </div></div>
      <p style="text-align:center">${game.won ? `You found them in <b>${game.guesses.length}</b> guess${game.guesses.length === 1 ? "" : "es"}.` : "Better luck next round!"}</p>
      ${mode === "daily" ? `<p class="muted" style="text-align:center">Next character in</p><div class="countdown" id="countdown"></div>` : ""}
      <div class="btn-row">
        <button class="btn secondary" id="share-btn">Copy result</button>
        ${mode === "endless" ? `<button class="btn" id="next-btn">New character</button>` : `<button class="btn" id="to-endless">Play Endless</button>`}
      </div>`);
    $("share-btn").onclick = () => copy(shareText());
    if ($("next-btn")) $("next-btn").onclick = () => { closeModal(); save("endless:current", null); newGame("endless"); input.focus(); };
    if ($("to-endless")) $("to-endless").onclick = () => { closeModal(); newGame("endless"); };
    if (mode === "daily") {
      const tick = () => {
        const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((next - now) / 1000));
        const el = $("countdown"); if (!el) return;
        el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, "0")).join(":");
      };
      tick(); countdownTimer = setInterval(tick, 1000);
    }
  }

  function showStats() {
    const block = (m, label) => {
      const s = load(`stats:${m}`, { played: 0, wins: 0, streak: 0, best: 0, totalGuesses: 0 });
      const avg = s.wins ? (s.totalGuesses / s.wins).toFixed(1) : "–";
      return `<h3>${label}</h3><div class="stats-grid">
        <div><b>${s.played}</b><span>Played</span></div><div><b>${s.wins}</b><span>Wins</span></div>
        <div><b>${s.streak}</b><span>${m === "daily" ? "Day streak" : "Win streak"}</span></div><div><b>${avg}</b><span>Avg. guesses</span></div></div>`;
    };
    openModal(`<h2>Your Log Pose</h2>${block("daily", "Daily")}${block("endless", "Endless")}`);
  }

  function showSettings() {
    openModal(`<h2>Settings</h2>
      <h3>Spoiler level</h3>
      <p class="muted">Only characters who have appeared by this point are included, and their stats (bounty, Haki, Devil Fruit…) are shown as of then.</p>
      ${Object.entries(SPOILER_LEVELS).map(([k, v]) => `
        <label class="radio ${k === settings.spoiler ? "sel" : ""}"><input type="radio" name="spoiler" value="${k}" ${k === settings.spoiler ? "checked" : ""}>
        <div><b>${v.label}</b><small>${v.note}</small></div></label>`).join("")}
      <p class="muted">Changing this starts a fresh Endless round. The Daily puzzle is tracked separately for each level.</p>
      <h3>Data</h3>
      <div class="btn-row" style="justify-content:flex-start"><button class="btn secondary" id="reset-btn">Reset stats &amp; progress</button></div>`);
    document.querySelectorAll('input[name="spoiler"]').forEach(r => r.onchange = () => {
      settings.spoiler = r.value; save("spoiler", r.value);
      document.querySelectorAll(".radio").forEach(l => l.classList.toggle("sel", l.querySelector("input").checked));
      save("endless:current", null);
      newGame(mode);
      toast(`Spoilers: ${SPOILER_LEVELS[r.value].label}`);
    });
    $("reset-btn").onclick = () => {
      if (!confirmReset()) return;
      Object.keys(localStorage).filter(k => k.startsWith(STORE) && k !== STORE + "spoiler").forEach(k => localStorage.removeItem(k));
      closeModal(); newGame(mode); toast("Progress reset");
    };
  }
  let resetArmed = false;
  function confirmReset() {
    if (resetArmed) { resetArmed = false; return true; }
    resetArmed = true; toast("Click again to confirm reset"); setTimeout(() => resetArmed = false, 3000); return false;
  }

  function showSpoilerPicker(onDone) {
    modalLocked = true;
    openModal(`<h2>Pick your spoiler level</h2>
      <p class="muted">Only characters (and stats like bounties, Haki and Devil Fruits) revealed up to this point will be used. You can change it any time in Settings ⚙️.</p>
      <div class="spoiler-pick">
        ${Object.entries(SPOILER_LEVELS).map(([k, v]) => `
          <button class="spoiler-choice" data-level="${k}"><b>${v.label}</b><small>${v.note}</small></button>`).join("")}
      </div>`);
    $("modal-close").classList.add("hidden");
    document.querySelectorAll(".spoiler-choice").forEach(b => b.onclick = () => {
      settings.spoiler = b.dataset.level; save("spoiler", b.dataset.level);
      save("endless:current", null);
      modalLocked = false; closeModal();
      newGame(mode);
      toast(`Spoilers: ${SPOILER_LEVELS[b.dataset.level].label}`);
      if (onDone) onDone();
    });
  }

  function showHelp() {
    openModal(`<h2>How to play</h2>
      <p>Guess the hidden One Piece character. Each guess reveals how its stats compare to the answer.</p>
      <ul>
        <li><b style="color:var(--correct)">Green</b>: exact match. <b style="color:#b39a14">Yellow</b>: partial match. <b style="color:var(--wrong)">Red</b>: no match.</li>
        <li><b>Affiliation</b>: green if the main group matches, yellow if they share any group, including former ones (hover a cell to see them all).</li>
        <li><b>Devil Fruit</b> and <b>Haki</b>: yellow if some types overlap. Haki: 👁️ Observation · 💪 Armament · 👑 Conqueror's. Anyone with Conqueror's counts as having all three.</li>
        <li><b>Last Bounty</b>, <b>Height</b> and <b>First Arc</b>: an arrow shows whether the answer is higher (later) or lower (earlier). Bounty is the World Government bounty; Marines count as ฿0.</li>
        <li><b>Origin</b> is the sea or region listed on the wiki (East Blue, Grand Line, Sky Islands…).</li>
      </ul>
      <h3>Hints</h3>
      <p>Hints unlock after ${HINTS.map(h => `${h.at} (${h.title.toLowerCase()})`).join(", ")} guesses.</p>
      <h3>Modes</h3>
      <p><b>Daily</b>: one character per day, the same for everyone on this spoiler level. <b>Endless</b>: unlimited random characters, with a Give up button.</p>
      <p class="muted">Stats and portraits from the One Piece Wiki (portraits need an internet connection; initials show if one can't load). Edit <code>characters.js</code> to add characters.</p>`);
  }

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 1800);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied to clipboard!"); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Copied!"); }
  }

  // ---------- events ----------
  input.addEventListener("input", showSuggestions);
  input.addEventListener("focus", () => input.value && showSuggestions());
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && currentList.length) { e.preventDefault(); setActive((activeIdx + 1) % currentList.length); }
    else if (e.key === "ArrowUp" && currentList.length) { e.preventDefault(); setActive((activeIdx - 1 + currentList.length) % currentList.length); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") closeSuggestions();
  });
  sugg.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); submit(currentList[+li.dataset.i].c.name); } });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) closeSuggestions(); });
  $("guess-btn").onclick = () => submit();
  $("giveup-btn").onclick = giveUp;
  $("hints").addEventListener("click", e => { const b = e.target.closest("button[data-hint]"); if (b) { game.revealed[+b.dataset.hint] = true; persist(); renderHints(); } });
  document.querySelectorAll(".mode").forEach(b => b.onclick = () => { if (b.dataset.mode !== mode) newGame(b.dataset.mode); });
  $("btn-help").onclick = showHelp;
  $("btn-stats").onclick = showStats;
  $("btn-settings").onclick = showSettings;
  $("spoiler-pill").onclick = showSettings;
  $("modal-close").onclick = closeModal;
  $("modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // expose for tests/debugging
  window.OPDLE = { statsAt, compare, pool, dailyTargetName, settings, arcIndex, fmtBounty, fmtHeight, matches: q => matches(q) };

  newGame(mode === "endless" ? "endless" : "daily");
  const showHelpOnce = () => { if (!load("seenHelp", false)) { save("seenHelp", true); showHelp(); } };
  // First visit: make the player choose a spoiler level before anything else, then show How to Play.
  let hasSpoilerChoice = false;
  try { hasSpoilerChoice = localStorage.getItem(STORE + "spoiler") !== null; } catch {}
  if (!hasSpoilerChoice) showSpoilerPicker(showHelpOnce); else showHelpOnce();
})();
