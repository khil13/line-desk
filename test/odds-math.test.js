const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toProb, toAmerican, payout, fmtOdds, devigPower,
  normCdf, invNorm, round5, modelLine, trim, middleWindow,
} = require("../lib/odds-math.js");

test("toProb converts American odds to implied probability", () => {
  assert.ok(Math.abs(toProb(-110) - 110 / 210) < 1e-9);
  assert.ok(Math.abs(toProb(150) - 100 / 250) < 1e-9);
  assert.equal(toProb(-50), null, "odds inside the no-vig line are rejected");
  assert.equal(toProb("nope"), null);
});

test("toAmerican is the inverse of toProb for both sides of even money", () => {
  for (const odds of [-200, -110, 120, 300]) {
    const p = toProb(odds);
    assert.ok(Math.abs(toAmerican(p) - odds) < 1e-6, `round-trip failed for ${odds}`);
  }
});

test("payout is the multiplier on a unit stake", () => {
  assert.ok(Math.abs(payout(-110) - 100 / 110) < 1e-9);
  assert.ok(Math.abs(payout(150) - 1.5) < 1e-9);
  assert.equal(payout(0), null);
});

test("fmtOdds signs positive prices and rounds", () => {
  assert.equal(fmtOdds(-110), "-110");
  assert.equal(fmtOdds(150.4), "+150");
  assert.equal(fmtOdds(null), "—");
});

test("devigPower removes the vig: probabilities sum to 1", () => {
  const [pa, pb] = devigPower([toProb(-110), toProb(-110)]);
  assert.ok(Math.abs(pa + pb - 1) < 1e-6);
  assert.ok(Math.abs(pa - 0.5) < 1e-6, "a pick'em market de-vigs to a coin flip");
});

test("devigPower keeps the favorite favored on a lopsided line", () => {
  const [favA, dogB] = devigPower([toProb(-300), toProb(250)]);
  assert.ok(Math.abs(favA + dogB - 1) < 1e-6);
  assert.ok(favA > dogB);
  assert.ok(favA < toProb(-300), "de-vigging must shave some probability off the raw favorite price");
});

test("normCdf and invNorm invert each other", () => {
  for (const z of [-2, -0.5, 0, 0.5, 2]) {
    assert.ok(Math.abs(invNorm(normCdf(z)) - z) < 1e-3, `failed for z=${z}`);
  }
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-9);
});

test("round5 snaps to the nearest half point", () => {
  assert.equal(round5(3.2), 3);
  assert.equal(round5(3.3), 3.5);
  assert.equal(round5(-6.8), -7);
});

test("modelLine turns a 50% win probability into a pick'em (0) spread", () => {
  assert.ok(Math.abs(modelLine(50) - 0) < 1e-9);
});

test("modelLine favors the side with the higher win probability with a negative line", () => {
  assert.ok(modelLine(65) < 0);
  assert.ok(modelLine(35) > 0);
  assert.equal(modelLine(null), null);
});

test("trim drops a trailing .0 but keeps other decimals", () => {
  assert.equal(trim(3.0), "3");
  assert.equal(trim(3.5), "3.5");
  assert.equal(trim(-7.0), "-7");
});

test("middleWindow finds a real middle on a spread when the away number is the bigger cushion", () => {
  // Away bought at home -6.5 (away +6.5), home bought at home -3.
  // A home win by 4, 5 or 6 cashes both: home covers -3, and away's +6.5
  // number means away only needed to lose by less than 6.5.
  const w = middleWindow("sp", -6.5, -3);
  assert.deepEqual(w, { lo: 3, hi: 6.5, width: 3.5, bothWin: true });
});

test("middleWindow finds a dead zone on a spread when the numbers cross the other way", () => {
  // Away bought at home -3 (away +3), home bought at home -6.5.
  // A home win by 4, 5 or 6 loses both: away needed a margin under 3,
  // home needed a margin over 6.5 — neither happened.
  const w = middleWindow("sp", -3, -6.5);
  assert.deepEqual(w, { lo: 3, hi: 6.5, width: 3.5, bothWin: false });
});

test("middleWindow finds a real middle on a total when Over's number is lower than Under's", () => {
  // Over bought at 55.5, Under bought at 58.5. A final total of 56, 57 or
  // 58 cashes both.
  const w = middleWindow("tot", 55.5, 58.5);
  assert.deepEqual(w, { lo: 55.5, hi: 58.5, width: 3, bothWin: true });
});

test("middleWindow finds a dead zone on a total when the numbers cross the other way", () => {
  const w = middleWindow("tot", 58.5, 55.5);
  assert.deepEqual(w, { lo: 55.5, hi: 58.5, width: 3, bothWin: false });
});

test("middleWindow is null when both sides came from the same number or are missing", () => {
  assert.equal(middleWindow("sp", -3, -3), null);
  assert.equal(middleWindow("tot", 55.5, 55.5), null);
  assert.equal(middleWindow("sp", null, -3), null);
  assert.equal(middleWindow("ml", NaN, NaN), null);
});
