# One Piece Dle

A local, Onepiecedle-style character guessing game.

## Run it
Double-click `index.html`. It opens in your browser, with no server or install needed.
(The title font loads from Google Fonts when you're online and falls back to Georgia when you're not.)

## Files
- `index.html`: page layout
- `style.css`: look and feel
- `app.js`: game logic (daily/endless, hints, comparisons, stats)
- `characters.js`: **all character data**. Edit this file to add characters.

## Adding a character
Copy any entry in `characters.js` and change the fields (instructions are at the top of the file).
- `debut` is the chapter number. It sets the First Arc column, and it hides the character
  if your spoiler setting stops before that chapter.
- `changes` holds stats that change mid-story (e.g. `{ ch: 1197, haki: "OAC" }` for Sanji).
  These are hidden on lower spoiler settings.
- To update the spoiler cut-offs when new chapters or episodes come out, edit `SPOILER_LEVELS`
  at the top of `characters.js`.

## Rules recap
- Green = exact, yellow = partial (shared affiliation, overlapping Devil Fruit or Haki types), red = wrong.
- Arrows on Bounty / Height / First Arc point toward the answer (higher or lower).
- Hints unlock at 4, 7 and 10 guesses: epithet, then Devil Fruit, then a clue.
- Progress and stats are saved in your browser (localStorage).

## Adding characters without changing today's Daily
Give every new character an `added: "YYYY-MM-DD"` field set to the day you add it. It becomes guessable
(and appears in Endless) immediately, but only enters the Daily rotation starting the next day, so the
current day's answer never changes mid-day.

## Spoiler levels & stat history

The spoiler setting lets players pick a completed arc (Alabasta → Egghead), the latest anime, or the latest manga.
Characters only appear once they've debuted (or their `reveal` chapter), and their stats are rolled back to how
they were at that point:

- `changes` in `characters.js` — `{ ch, field: value }` entries that apply **from** chapter `ch` onward (newer reveals).
- `EARLY` in `history.js` — `[untilChapter, { field: value }]` entries that apply **before** `untilChapter`
  (older values, e.g. Luffy's 30M bounty before ch. 435). When several match, the earliest one wins.

To add an arc option, add an entry with `type: "arc"` to `SPOILER_LEVELS` in `characters.js`.

## Picture games (Jolly Roger, Devil Fruit)

`imagegame.js` is a shared engine (zoom-out picture, search, hints, Daily/Endless, stats, streak). Each game is a
small config file that calls `makeImageGame(...)`: `flaggame.js` (data in `flags.js`) and `fruitgame.js`
(data in `fruits.js`). To add a flag or fruit, add an entry with a new, unique `id` — never rename an `id` once it's
live, because the daily order depends on it.
