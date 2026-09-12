# Line Desk

A college football line shopper. Enter or pull odds from several sportsbooks, strip the vig out,
and see which book is actually offering the best number on each side.

Single static HTML file. No build step, no server, no dependencies to install.

## Run it

Open `index.html` in a browser. That's it.

To host it on GitHub Pages: push this repo, then **Settings → Pages → Source: deploy from
branch → `main` / root**. It'll be live at `https://<you>.github.io/<repo>/`.

## Development

The odds conversion, de-vig and normal-curve math live in `lib/odds-math.js`, and the live field
diagram's coordinate math lives in `lib/field-geometry.js` — small, dependency-free modules that
`index.html` loads as plain `<script>` tags and that `ncaaf-line-desk.jsx` and the tests
`require()`. They're the one place each piece of logic is defined, so fixing a bug there fixes it
everywhere.

`ncaaf-line-desk.jsx` is a plain-module mirror of the component embedded in `index.html`, kept
around for editors/tooling that want a real `import`/`export` file to open. If you touch the
component, apply the same edit to both files — nothing currently checks that they've stayed in
sync.

Run the math tests with `node --test` (Node 18+, nothing to install):

```
node --test
```

## What it does

**Line shopping.** Fill in what each book is offering and it ranks them by expected value,
comparing the *number and the price together* — so it knows that `+30.5 (-110)` beats
`+29.5 (-108)`, which is not obvious by eye. It highlights the best cell on each side and
reports what shopping saves you against your worst book.

**De-vigging.** Converts American odds to implied probability and removes the house cut, using
either the proportional method or a power solve. Power is the default because proportional
badly overstates heavy favorites, and college football is full of them.

**Middles.** When the two best-priced sides come from books quoting different numbers, it works
out the exact window where both bets cash — and, since the two numbers can cross the other way,
flags it just as plainly when that window is a dead zone where both bets lose instead. Either way
it reports how much of the discrete margin (or total) distribution actually lands in that window,
not just its width.

**Line movement.** Enter the opener and it reports how far the number has moved and toward whom.

**Model comparison.** Plots the feed's model, a second model you supply (ESPN's Matchup
Predictor works), the opening line, and the current market on a shared scale. The distance
between the two models is your honest uncertainty band.

**Board scan.** Sweeps every game and sorts by how far apart the books are, flagging gaps that
cross key numbers (3, 7, 10, 14).

**Live scores**, rankings, records and schedule, refreshing every 30 seconds during games. Open a
live game on the Live tab and it draws the field: the ball spotted where it actually is, the
line to gain marked, the offense always running left to right regardless of which real end zone
they're facing. Falls back to the plain down-and-distance text if that data isn't there.

## Data sources

Two paths, and the split matters:

**Free — no key, no account, no quota.** ESPN's public JSON endpoints supply the schedule, live
scores and status, team records, AP rankings, real school colors, and one sportsbook line per
game. Everything above that doesn't say otherwise runs on this.

**Paid — your own Anthropic API key, only when you tap the button.** Multi-book odds
comparison, team facts and series history, and the per-game read. These need real research
across sources, which ESPN can't provide.

The app works without a key. You just lose those three features.

### About the ESPN endpoints

They're public and keyless but **undocumented and unofficial**. They can change or disappear
without notice. Every call tries two hosts, then a 24-hour local cache, then a built-in
snapshot, so the app degrades instead of breaking. If you see the amber banner, that's the
fallback talking.

Note that these calls fail inside sandboxed preview environments that restrict outbound
requests. That's the environment, not ESPN. Served from Pages or opened locally, they work.

## API key handling

The key lives in your browser's `localStorage` and is sent only to `api.anthropic.com`. It is
never written into the file and never committed.

**Do not hardcode a key into `index.html` and push it.** If you ever do, revoke it immediately
at console.anthropic.com — GitHub history keeps it even after you delete the line.

Browser-side API calls require the `anthropic-dangerous-direct-browser-access` header, which
this app sets. That's fine for a personal tool where you supply your own key. Don't build a
public service on this pattern.

## Known limitations

These are real and worth understanding before you bet anything.

- **The math assumes a normal curve.** Converting between prices and spreads models margins as
  normally distributed (σ = 16) and totals likewise (σ = 10.5). Football margins are not smooth
  — 3 and 7 occur far more often than a bell curve allows. Treat small edges near key numbers
  as model error, not opportunity.
- **Whole-number lines can push.** The probabilities here ignore ties.
- **EV is measured against your chosen benchmark.** A positive number means one book disagrees
  with the others, not that the market is wrong. Against a retail consensus it's mostly
  measuring vig. A sharp book as the benchmark is what makes the column mean something.
- **Team-facts and game-read output is unverified.** It comes from web research and can be
  wrong. Check anything you'd act on.
- **Don't live bet off the scores.** They're a real feed, but anyone watching the broadcast
  sees the play before the scoreboard updates.
- **The field diagram reads an ESPN field it hasn't been checked against live.** It's built from
  documented shapes for `situation.yardsToEndzone`/`distance`, not a payload watched during an
  actual game. If ESPN's field turns out different it just won't draw — you'll still get the
  down-and-distance text — but treat the ball spot as unverified until you've watched it live.

## License

MIT. See `LICENSE`.

---

Gambling should stay fun. If it stops being fun, 1-800-GAMBLER is free and confidential.
