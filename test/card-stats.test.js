const test = require("node:test");
const assert = require("node:assert/strict");
const { pickStats, bookLines, sideLine } = require("../lib/card-stats.js");

const val = (rows, k) => rows.find((r) => r.k === k);
const bk = (k, s) => ({ k, s, n: s });

test("sideLine flips a home margin into the away side's spread", () => {
  assert.equal(sideLine(7, true), -7);   // home favoured by 7 → home -7
  assert.equal(sideLine(7, false), 7);   // ...so the away side is +7
});

test("spread stats read from the picked side, with the bar it cleared", () => {
  const c = {
    kind: "spread", sideHome: false, gap: -3.2, need: 1.5, pModel: 0.58, ev: 0.07, price: "-110",
    res: { cons: 7, count: 3, usePin: false }, modelMu: 3.8, espnMu: 4.1, powerMu: 3.5, both: true,
    onKey: false,
  };
  const rows = pickStats(c);
  assert.equal(val(rows, "Market").v, "+7");
  assert.equal(val(rows, "Model").v, "+3.8");
  assert.equal(val(rows, "Model").note, "ESPN +4.1 · ratings +3.5");
  assert.equal(val(rows, "Edge").v, "3.2 pts");
  assert.equal(val(rows, "Edge").ok, true);
  assert.equal(val(rows, "Covers").v, "58.0%");
  assert.equal(val(rows, "Fair price").v, "-138");
  assert.equal(val(rows, "Value").v, "+7.0%");
});

test("moneyline market probability is taken from the picked side", () => {
  const c = { kind: "moneyline", sideHome: false, edge: 0.03, need: 0.04, pModel: 0.4,
              ev: 0.01, price: 160, res: { cons: 0.63 } };
  const rows = pickStats(c);
  assert.equal(val(rows, "Market").v, "37.0%");
  assert.equal(val(rows, "Edge").ok, false);
  assert.equal(val(rows, "Value").ok, false);
  assert.equal(val(rows, "Fair price").v, "+150");
});

test("totals show market, projection and the 35/65 blend", () => {
  const c = { kind: "total", over: false, gap: -2.1, need: 1.5, pModel: 0.56, ev: 0.04,
              price: -105, proj: 48.0, drag: 2.5, res: { cons: 54, count: 2, usePin: false } };
  const rows = pickStats(c);
  assert.equal(val(rows, "Market").v, "54");
  assert.equal(val(rows, "Projection").note, "after −2.5 for conditions");
  assert.equal(val(rows, "Blended").v, "51.9");
  assert.ok(val(rows, "Stays under"));
});

test("bookLines quotes every book on the picked side, best book first", () => {
  const c = {
    kind: "spread", sideHome: true, best: { bk: bk("fd", "FD") },
    res: { priced: [
      { bk: bk("dk", "DK"), L: -6.5, oa: "-110", ob: "-110", evA: -0.05, evB: -0.04 },
      { bk: bk("fd", "FD"), L: -6, oa: "-112", ob: "-108", evA: -0.06, evB: -0.01 },
    ] },
  };
  const out = bookLines(c);
  assert.deepEqual(out.map((b) => [b.book, b.line, b.price, b.best]),
    [["FD", "−6", "-108", true], ["DK", "−6.5", "-110", false]]);
});

test("bookLines uses over/under prices for totals", () => {
  const c = { kind: "total", over: true, best: { bk: bk("dk", "DK") },
              res: { priced: [{ bk: bk("dk", "DK"), L: 52.5, oa: "-105", ob: "-115", evA: 0, evB: 0 }] } };
  assert.deepEqual(bookLines(c)[0], { book: "DK", line: "o52.5", price: "-105", ev: 0, best: true });
});
