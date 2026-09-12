const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toProb, toAmerican, payout, fmtOdds, devigPower,
  normCdf, invNorm, round5, modelLine, trim,
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
