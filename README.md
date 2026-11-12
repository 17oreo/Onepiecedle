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
