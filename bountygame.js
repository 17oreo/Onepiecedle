/* Onepiecedle — Bounty Higher or Lower.
 * Two characters: the left one's bounty is shown, guess whether the right one's is higher or lower.
 * Keep going until you're wrong. Bounties are taken as of the chosen spoiler level (statsAt in app.js). */
(() => {
  "use strict";
  const A = window.OPDLE_API;
  if (!A) return;
  const { load, save, esc, seededShuffle, dayNumber, todayKey, settings, fmtBounty, avatar } = A;
  const ID = "bounty", SEED = 50000000;
  const view = document.getElementById("bounty-view");
  const $ = id => document.getElementById("bounty-" + id);

  view.innerHTML = `
    <section class="panel bounty-panel">
      <div class="bounty-score"><span>Score <b id="bounty-score">0</b></span><span class="muted" id="bounty-best"></span></div>
      <div class="bounty-cards" id="bounty-cards"></div>
      <div class="bounty-actions" id="bounty-actions">
        <button class="btn bounty-btn up" data-pick="higher">▲ Higher</button>
        <button class="btn bounty-btn down" data-pick="lower">▼ Lower</button>
      </div>
      <p class="muted bounty-note" id="bounty-note"></p>
    </section>`;

  // ---------- data ----------
  const addedDay = s => { const [y, m, d] = s.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  // Characters with a known, non-zero bounty at this spoiler level
  const pool = () => A.characterPool().filter(c => typeof c.bounty === "number" && c.bounty > 0);
  const byName = n => pool().find(c => c.name === n);
  function dailySequence() {
    const today = dayNumber();
    const names = pool().filter(c => !c.added || addedDay(c.added) < today).map(c => c.key || c.name).sort();
    const keyToName = Object.fromEntries(pool().map(c => [c.key || c.name, c.name]));
    // A fresh shuffle each day, the same for everyone on this spoiler level
    return seededShuffle(names, SEED + today).map(k => keyToName[k]);
  }
  function randomSequence() { return seededShuffle(pool().map(c => c.name), Math.floor(Math.random() * 1e9)); }

  // ---------- state ----------
  let mode = load(ID + ":mode", "daily") === "endless" ? "endless" : "daily";
  let game = null, busy = false;
  // game = { key, seq: [names], i: index of the left card, score, done, picks: [true/false] }
  function newGame(m) {
    mode = m; save(ID + ":mode", m);
    if (m === "daily") {
      const key = `${ID}:daily:${todayKey()}:${settings.spoiler}`;
      game = load(key, null) || { key, seq: dailySequence(), i: 0, score: 0, done: false, picks: [] };
      game.key = key;
    } else {
      const saved = load(ID + ":endless:current", null);
      game = saved && saved.spoiler === settings.spoiler && !saved.done ? { ...saved, key: ID + ":endless:current" }
        : { key: ID + ":endless:current", seq: randomSequence(), i: 0, score: 0, done: false, picks: [] };
    }
    // Saved games may refer to characters that are no longer in the pool; drop them
    game.seq = game.seq.filter(n => byName(n));
    persist(); render();
  }
  function persist() { const { key, ...rest } = game; save(game.key, { ...rest, spoiler: settings.spoiler }); }

  // ---------- render ----------
  function card(c, reveal, cls = "") {
    return `<div class="bounty-card ${cls}">
      ${avatar(c.name)}
      <div class="bc-name">${esc(c.name)}</div>
      <div class="bc-aff muted">${esc(c.aff[0])}</div>
      <div class="bc-bounty ${reveal ? "" : "hidden-bounty"}" data-target="${c.bounty}">${reveal ? fmtBounty(c.bounty) : "฿ ???"}</div>
    </div>`;
  }
  function render() {
    if (!A.isActive(ID)) return;
    document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    document.getElementById("intro-title").textContent = mode === "daily" ? "Today's Bounty run!" : "Endless Bounty run!";
    document.getElementById("intro-sub").textContent = `Is the next bounty higher or lower? One wrong answer ends the run. ${pool().length} characters with a bounty at this spoiler level.`;
    document.getElementById("spoiler-pill").textContent = A.spoilerPillText();
    const left = byName(game.seq[game.i]), right = byName(game.seq[game.i + 1]);
    $("score").textContent = game.score;
    const best = load(`stats:${ID}:${mode}`, {}).best || 0;
    $("best").textContent = mode === "daily" ? (game.done ? "Run finished" : "One run per day") : `Best ${best}`;
    if (!left || !right) { // ran out of characters: you beat the whole pool!
      $("cards").innerHTML = `<div class="bounty-done">🏆 You went through every bounty!</div>`;
    } else {
      $("cards").innerHTML = card(left, true) + `<div class="bounty-vs">VS</div>` + card(right, game.done);
    }
    $("actions").classList.toggle("hidden", game.done || !right);
    $("note").innerHTML = game.done
      ? `<button class="btn" id="bounty-again">${mode === "daily" ? "Play Endless" : "New run"}</button> <button class="btn secondary" id="bounty-share">Copy result</button>`
      : "Equal bounties count as correct either way.";
    if (game.done) {
      $("again").onclick = () => { if (mode === "daily") newGame("endless"); else { save(ID + ":endless:current", null); newGame("endless"); } };
      $("share").onclick = () => A.copy(shareText());
    }
    const y = document.getElementById("yesterday"); y.innerHTML = "";
    A.renderStreak(false, { mode, key: `stats:${ID}:daily` });
  }

  // Count the hidden bounty up from 0, then call done()
  function countUp(el, done) {
    const target = +el.dataset.target, t0 = performance.now(), dur = 700;
    el.classList.remove("hidden-bounty");
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = fmtBounty(v);
      if (k < 1) requestAnimationFrame(step); else { el.textContent = fmtBounty(target); done(); }
    };
    requestAnimationFrame(step);
  }

  function pick(dir) {
    if (busy || game.done) return;
    const left = byName(game.seq[game.i]), right = byName(game.seq[game.i + 1]);
    if (!left || !right) return;
    busy = true;
    const ok = left.bounty === right.bounty || (dir === "higher" ? right.bounty > left.bounty : right.bounty < left.bounty);
    const cards = $("cards").querySelectorAll(".bounty-card"), rc = cards[1];
    $("actions").classList.add("hidden");
    countUp(rc.querySelector(".bc-bounty"), () => {
      rc.classList.add(ok ? "right" : "wrong");
      game.picks.push(ok);
      setTimeout(() => {
        busy = false;
        if (ok) { game.score++; game.i++; persist(); render(); }
        else { game.done = true; persist(); record(); render(); showEnd(); }
      }, ok ? 650 : 900);
    });
  }

  function record() {
    const key = `stats:${ID}:${mode}`;
    const s = load(key, { played: 0, total: 0, best: 0, streak: 0, lastDay: null });
    s.played++; s.total = (s.total || 0) + game.score; s.best = Math.max(s.best || 0, game.score);
    if (mode === "daily") { const today = dayNumber(); s.streak = s.lastDay === today ? s.streak : (s.lastDay === today - 1 ? s.streak + 1 : 1); s.lastDay = today; }
    save(key, s);
    if (mode === "daily") A.renderStreak(true, { mode, key });
  }
  function shareText() {
    const marks = game.picks.map(p => p ? "🟩" : "🟥").join("");
    return `Onepiecedle Bounty — ${mode === "daily" ? todayKey() : "Endless"} (${SPOILER_LEVELS[settings.spoiler].short})\nScore: ${game.score} 💰\n${marks}`;
  }
  function showEnd() {
    const s = load(`stats:${ID}:${mode}`, {});
    A.openModal(`<h2>${game.score >= 10 ? "Yohohoho, rich!" : "Run over!"}</h2>
      <p style="text-align:center;font-size:18px">You scored <b>${game.score}</b>${mode === "endless" ? ` · Best <b>${s.best || game.score}</b>` : ""}</p>
      <div class="btn-row"><button class="btn secondary" id="bounty-m-share">Copy result</button>
      <button class="btn" id="bounty-m-again">${mode === "daily" ? "Play Endless" : "New run"}</button></div>`);
    $("m-share").onclick = () => A.copy(shareText());
    $("m-again").onclick = () => { A.closeModal(); if (mode === "endless") save(ID + ":endless:current", null); newGame("endless"); };
  }

  const statsHTML = () => {
    const d = load(`stats:${ID}:daily`, {}), e = load(`stats:${ID}:endless`, {});
    const avg = s => s.played ? (s.total / s.played).toFixed(1) : "–";
    return `<h3>Daily</h3><div class="stats-grid"><div><b>${d.played || 0}</b><span>Played</span></div><div><b>${d.best || 0}</b><span>Best score</span></div>
      <div><b>${d.streak || 0}</b><span>Day streak</span></div><div><b>${avg(d)}</b><span>Avg. score</span></div></div>
      <h3>Endless</h3><div class="stats-grid"><div><b>${e.played || 0}</b><span>Runs</span></div><div><b>${e.best || 0}</b><span>Best score</span></div>
      <div><b>${avg(e)}</b><span>Avg. score</span></div><div><b>${game && mode === "endless" && !game.done ? game.score : "–"}</b><span>Current run</span></div></div>`;
  };
  const helpHTML = () => `<h2>How to play: Bounty</h2>
    <p>You see one character's bounty. Guess whether the next character's bounty is <b>higher</b> or <b>lower</b>.</p>
    <ul>
      <li>Every right answer is a point, and the next character slides in. One wrong answer ends the run.</li>
      <li>Equal bounties count as correct either way.</li>
      <li>Bounties are shown as they were at your spoiler level, and only characters with a known bounty above ฿0 are included (so no Marines).</li>
    </ul>
    <p><b>Daily</b>: one run per day, with the same order of characters for everyone on this spoiler level. <b>Endless</b>: as many runs as you like; your best score is saved.</p>`;

  view.addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if (b) pick(b.dataset.pick); });
  document.addEventListener("keydown", e => {
    if (!A.isActive(ID) || document.activeElement && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowUp") pick("higher"); else if (e.key === "ArrowDown") pick("lower");
  });

  newGame(mode);
  A.register(ID, {
    label: "💰 Bounty",
    show: render,
    setMode: m => { if (m !== mode) newGame(m); },
    onSpoilerChange: () => { save(ID + ":endless:current", null); newGame(mode); },
    helpHTML, statsHTML,
  });
  window.OPDLE_BOUNTY = { pool, dailySequence, pick, get game() { return game; } };
})();
