/* The numbers behind a Card pick, laid out for display: market against model,
   the edge against the bar it had to clear, the fair price, and what every
   book is offering on that side. Pure — it reads the object assess(),
   assessML() or assessTotal() returns and formats nothing it wasn't given.
   index.html loads this as a plain <script> global (window.CardStats);
   ncaaf-line-desk.jsx and the tests require() it. */
(function (root, factory) {
  const odds = typeof module === "object" && module.exports
    ? require("./odds-math.js") : root.OddsMath;
  const mod = factory(odds);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.CardStats = mod;
})(typeof self !== "undefined" ? self : this, function ({ toAmerican, fmtOdds, trim }) {

const pct = (p) => (p * 100).toFixed(1) + "%";
const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + trim(Math.abs(x));
const evText = (ev) => (ev >= 0 ? "+" : "−") + Math.abs(ev * 100).toFixed(1) + "%";
const fair = (p) => fmtOdds(toAmerican(p));
// Win chance with the push shown beside it, when a whole-number line allows one.
const winRow = (k, c) => ({
  k, v: pct(c.pWin ?? c.pModel),
  note: c.pPush > 0.005 ? `push ${pct(c.pPush)}` : null,
});

// Margins are carried from the home team's side (positive = home wins by).
// A spread is quoted from the bettor's side, so flip it for the away team.
const sideLine = (homeMargin, sideHome) => (sideHome ? -homeMargin : homeMargin);

function pickStats(c) {
  const rows = [];
  if (c.kind === "spread") {
    rows.push({ k: "Market", v: signed(sideLine(c.res.cons, c.sideHome)),
                note: c.res.usePin ? "Pinnacle" : `${c.res.count}-book consensus` });
    rows.push({ k: "Model", v: signed(sideLine(c.modelMu, c.sideHome)),
                note: c.both
                  ? `ESPN ${signed(sideLine(c.espnMu, c.sideHome))} · ratings ${signed(sideLine(c.powerMu, c.sideHome))}`
                  : "ESPN only" });
    rows.push({ k: "Edge", v: Math.abs(c.gap).toFixed(1) + " pts",
                note: c.need != null ? `needs ${c.need.toFixed(1)}` : null,
                ok: c.need == null ? null : Math.abs(c.gap) >= c.need });
    const r = winRow("Covers", c);
    if (c.onKey) r.note = r.note ? r.note + " · key number" : "on a key number";
    rows.push(r);
  } else if (c.kind === "moneyline") {
    const mkt = c.sideHome ? c.res.cons : 1 - c.res.cons;
    rows.push({ k: "Market", v: pct(mkt), note: "win chance, vig removed" });
    rows.push({ k: "Model", v: pct(c.pModel), note: "win chance" });
    rows.push({ k: "Edge", v: (c.edge * 100).toFixed(1) + " pts",
                note: c.need != null ? `needs ${(c.need * 100).toFixed(0)}` : null,
                ok: c.need == null ? null : c.edge >= c.need });
  } else {
    rows.push({ k: "Market", v: trim(c.res.cons),
                note: c.res.usePin ? "Pinnacle" : `${c.res.count}-book consensus` });
    rows.push({ k: "Projection", v: c.proj.toFixed(1),
                note: c.drag > 0.3 ? `after −${c.drag.toFixed(1)} for conditions` : "scoring model" });
    rows.push({ k: "Blended", v: (c.res.cons + c.gap).toFixed(1), note: "35% model, 65% market" });
    rows.push({ k: "Edge", v: Math.abs(c.gap).toFixed(1) + " pts",
                note: c.need != null ? `needs ${c.need.toFixed(1)}` : null,
                ok: c.need == null ? null : Math.abs(c.gap) >= c.need });
    rows.push(winRow(c.over ? "Goes over" : "Stays under", c));
  }
  // Priced on wins out of the bets that don't push — a push is money back.
  rows.push({ k: "Fair price", v: fair(c.pFair ?? c.pModel), note: `you get ${fmtOdds(parseFloat(c.price))}` });
  rows.push({ k: "Value", v: evText(c.ev), note: "per unit, if the model is right",
              ok: c.ev >= 0.02 });
  return rows;
}

// What every book quotes on the side being picked, best first.
function bookLines(c) {
  const out = [];
  for (const q of (c.res && c.res.priced) || []) {
    let line = null, price;
    if (c.kind === "spread") {
      line = signed(c.sideHome ? q.L : -q.L);
      price = c.sideHome ? q.ob : q.oa;
    } else if (c.kind === "moneyline") {
      price = c.sideHome ? q.ob : q.oa;
    } else {
      line = (c.over ? "o" : "u") + trim(q.L);
      price = c.over ? q.oa : q.ob;
    }
    out.push({ book: q.bk.s, line, price: fmtOdds(parseFloat(price)),
               ev: c.kind === "total" ? (c.over ? q.evA : q.evB) : (c.sideHome ? q.evB : q.evA),
               best: !!(c.best && c.best.bk && q.bk.k === c.best.bk.k) });
  }
  return out.sort((a, b) => (b.best - a.best) || ((b.ev ?? -9) - (a.ev ?? -9)));
}

return { pickStats, bookLines, sideLine };

});
