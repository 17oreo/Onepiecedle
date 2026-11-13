/* One Piece Dle — Jolly Roger game (data in flags.js, engine in imagegame.js). */
(() => {
  "use strict";
  if (!window.makeImageGame || typeof FLAGS === "undefined") return;
  const A = window.OPDLE_API;
  const charByName = new Map(CHARACTERS.map(c => [c.name, c]));
  // Value as of the chosen spoiler level: [[untilChapter, olderValue], ...]
  const asOf = (v, early) => { (early || []).slice().sort((a, b) => b[0] - a[0]).forEach(([u, old]) => { if (A.chapter() < u) v = old; }); return v; };
  const kindAt = f => asOf(f.kind, f.kindEarly);
  const initialsOf = name => name.replace(/^Saint\s+/, "").split(/\s+/).map(w => w[0].toUpperCase() + ".").join(" ");

  window.OPDLE_FLAGS = makeImageGame({
    id: "flags", label: "🏴‍☠️ Jolly Roger", icon: "🏴‍☠️", noun: "flag", shareName: "Jolly Roger",
    seed: 77100429,
    zoom: [4.2, 3.2, 2.5, 2.0, 1.6, 1.3, 1.1, 1],
    items: FLAGS,
    chOf: f => f.ch,
    imgOf: f => asOf(f.img, f.imgEarly),
    nameOf: f => f.name,
    subOf: f => f.captains.join(" / "),
    // Every name that counts: the flag's name, extra answers, captains and the captains' aliases from characters.js
    namesFor: f => {
      const out = [f.name, ...(f.answers || [])];
      for (const cap of f.captains) { out.push(cap); const c = charByName.get(cap); if (c) out.push(...c.aliases); }
      return out;
    },
    suggestSub: (f, via) => (via && !f.captains.includes(via) ? via + " · " : "") + "Captain: " + f.captains.join(" / "),
    hints: [
      { at: 3, title: "First appearance", get: f => `Chapter ${f.ch} · ${ARCS[A.arcIndex(f.ch)][0]} arc` },
      { at: 6, title: "Type", get: kindAt },
      { at: 9, title: "Captain's initials", get: f => initialsOf(f.captains[0]) },
    ],
    introTitle: m => m === "daily" ? "Guess today's Jolly Roger!" : "Endless mode — guess a random Jolly Roger!",
    introSub: n => `${n} flags in the pool. Type the crew or its captain. The flag zooms out with every wrong guess.`,
    placeholder: () => "Crew or captain name…",
    pickToast: "Pick a crew or captain from the list",
    yesterdayLabel: "Yesterday's Jolly Roger",
    endDetail: f => `Captain: ${f.captains.join(" / ")} · ${kindAt(f)}`,
    helpHTML: () => `<h2>How to play: Jolly Roger</h2>
      <p>Name the crew that flies this Jolly Roger. You can type the <b>crew</b> (Heart Pirates) or its <b>captain</b> (Law). Personal flags, like the ones Oda drew for each Straw Hat, are answered with that person's name.</p>
      <ul>
        <li>The flag starts zoomed in and <b>zooms out with every wrong guess</b>.</li>
        <li>Hints unlock after 3 (first appearance), 6 (type) and 9 (captain's initials) guesses.</li>
        <li>Guesses are unlimited, and you can give up at any time.</li>
      </ul>
      <p><b>Daily</b>: one flag per day, the same for everyone on this spoiler level. <b>Endless</b>: random flags, back to back.</p>
      <p class="muted">Flag images from the One Piece Wiki.</p>`,
  });
})();
