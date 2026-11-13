/* One Piece Dle — Devil Fruit game (data in fruits.js, engine in imagegame.js). */
(() => {
  "use strict";
  if (!window.makeImageGame || typeof FRUITS === "undefined") return;
  const A = window.OPDLE_API;
  const charByName = new Map(CHARACTERS.map(c => [c.name, c]));
  const asOf = (v, early) => { (early || []).slice().sort((a, b) => b[0] - a[0]).forEach(([u, old]) => { if (A.chapter() < u) v = old; }); return v; };
  const nameAt = f => asOf(f.name, f.nameEarly);
  const enAt = f => asOf(f.en[0], f.enEarly);
  const typeAt = f => asOf(f.type, f.typeEarly);
  const initialsOf = name => name.split(/\s+/).map(w => w[0].toUpperCase() + ".").join(" ");
  // A fruit's Japanese name without "no Mi" also counts ("Ope Ope"), and so does "Gomu Gomu no Mi" style English
  const shortName = jp => jp.replace(/ no Mi/, "");

  let hard = A.load("fruits:hard", false) === true;

  window.OPDLE_FRUITS = makeImageGame({
    id: "fruits", label: "🍇 Devil Fruit", icon: "🍇", noun: "fruit", shareName: "Devil Fruit",
    seed: 31415926,
    zoom: [2.6, 2.2, 1.9, 1.6, 1.4, 1.2, 1.1, 1],   // gentler than the flags
    focusRange: [35, 65],
    items: FRUITS,
    chOf: f => f.ch,
    imgOf: f => f.img,
    nameOf: nameAt,
    subOf: f => enAt(f),
    namesFor: f => {
      // Below a renaming chapter (Gomu Gomu → Nika) only the older names are searchable, so nothing gets spoiled
      const early = nameAt(f) !== f.name;
      const out = early ? [nameAt(f), shortName(nameAt(f)), enAt(f)] : [f.name, shortName(f.name), ...f.en, ...(f.nameEarly || []).map(x => x[1])];
      if (!hard) for (const u of f.users) { out.push(u); const c = charByName.get(u); if (c) out.push(...c.aliases); }
      return out;
    },
    suggestSub: (f, via) => {
      const users = f.users.join(" / ");
      if (via && f.users.some(u => u === via || (charByName.get(u) || { aliases: [] }).aliases.includes(via))) return `${enAt(f)} · eaten by ${users}`;
      return enAt(f);
    },
    hints: [
      { at: 3, title: "Type", get: typeAt },
      { at: 6, title: "First used", get: f => `Chapter ${f.ch} · ${ARCS[A.arcIndex(f.ch)][0]} arc` },
      { at: 9, title: "User's initials", get: f => initialsOf(f.users[0]) },
    ],
    introTitle: m => m === "daily" ? "Guess today's Devil Fruit!" : "Endless mode — guess a random Devil Fruit!",
    introSub: n => `${n} fruits in the pool. Type the fruit's name in Japanese or English${hard ? "" : ", or who ate it"}. The picture zooms out with every wrong guess.`,
    placeholder: () => hard ? "Fruit name (Japanese or English)…" : "Fruit name or its user…",
    pickToast: "Pick a Devil Fruit from the list",
    yesterdayLabel: "Yesterday's Devil Fruit",
    shareExtra: () => hard ? " · Hard" : "",
    endDetail: f => `${enAt(f)} · ${typeAt(f)} · Eaten by ${f.users.join(" / ")}`,

    // Normal / Hard toggle above the picture
    controlsHTML: () => `<div class="ig-diff" role="group" aria-label="Difficulty">
      <button data-diff="normal" class="${hard ? "" : "on"}">Normal</button><button data-diff="hard" class="${hard ? "on" : ""}">Hard</button></div>
      <span class="ig-diff-note muted" id="fruits-diff-note"></span>`,
    onMount: (view, rerender) => {
      view.querySelectorAll("[data-diff]").forEach(b => b.onclick = () => {
        hard = b.dataset.diff === "hard"; A.save("fruits:hard", hard);
        view.querySelectorAll("[data-diff]").forEach(x => x.classList.toggle("on", x === b));
        A.toast(hard ? "Hard: fruit names only" : "Normal: fruit names or users");
        rerender();
      });
    },
    afterRender: view => {
      const note = view.querySelector("#fruits-diff-note");
      if (note) note.textContent = hard ? "Fruit names only" : "Fruit names or users";
    },
    helpHTML: () => `<h2>How to play: Devil Fruit</h2>
      <p>Name the Devil Fruit in the picture. Its Japanese name (<i>Ope Ope no Mi</i> or just <i>Ope Ope</i>) and its English name (<i>Op-Op Fruit</i>) both count.</p>
      <ul>
        <li><b>Normal</b>: you can also type who ate it (typing Ace or Sabo both find the Mera Mera no Mi). <b>Hard</b>: fruit names only.</li>
        <li>The picture starts zoomed in and <b>zooms out with every wrong guess</b>.</li>
        <li>Hints unlock after 3 (type), 6 (first used) and 9 (user's initials) guesses.</li>
        <li>Only fruits whose actual fruit has been drawn are in the game.</li>
      </ul>
      <p><b>Daily</b>: one fruit per day, the same for everyone on this spoiler level. <b>Endless</b>: random fruits, back to back.</p>
      <p class="muted">Fruit images from the One Piece Wiki.</p>`,
  });
})();
