/* Odds math: American-odds conversion, power de-vig, and the normal-curve
   helpers used to turn a win probability into a spread. Pure, deterministic,
   no DOM/network/React — the one place this logic is defined. index.html
   loads this as a plain <script> global (window.OddsMath); ncaaf-line-desk.jsx
   and the tests require() it as CommonJS. Keep it in sync with itself, not
   duplicated elsewhere. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.OddsMath = mod;
})(typeof self !== "undefined" ? self : this, function () {

const SIG_M = 16.0;

const toProb = (o) => {
  const x = parseFloat(o);
  if (!isFinite(x) || Math.abs(x) < 100) return null;
  return x < 0 ? -x / (-x + 100) : 100 / (x + 100);
};
const toAmerican = (p) =>
  p == null || p <= 0 || p >= 1 ? null : p >= 0.5 ? -(100 * p) / (1 - p) : (100 * (1 - p)) / p;
const payout = (o) => {
  const x = parseFloat(o);
  return !isFinite(x) || x === 0 ? null : x > 0 ? x / 100 : 100 / -x;
};
const fmtOdds = (o) => (o == null ? "—" : (o > 0 ? "+" : "") + Math.round(o));

const devigPower = (ps) => {
  let lo = 0.0001, hi = 20;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    if (ps.reduce((a, p) => a + Math.pow(p, mid), 0) > 1) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const raw = ps.map((p) => Math.pow(p, k));
  const t = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / t);
};
const erf = (x) => {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429*t - 1.453152027)*t + 1.421413741)*t - 0.284496736)*t + 0.254829592) * t * Math.exp(-x*x));
};
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

const invNorm = (p) => {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let q, r;
  if (p < 0.02425) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= 0.97575) {
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
};

const round5 = (x) => Math.round(x * 2) / 2;
const modelLine = (wp) => (wp == null ? null : -SIG_M * invNorm(wp / 100));
const trim = (x) => Number(x).toFixed(1).replace(/\.0$/, "");

/* Two books rarely quote the same number, and each side of a shopped bet
   can come from a different one. When they do, there's a specific window
   between the two numbers — either one where BOTH bets cash (a middle) or,
   just as easily if the numbers cross the other way, one where BOTH lose
   (the cost of stitching two books' lines together instead of taking one).

   laSpread/lbSpread are each book's HOME line (e.g. -6.5). A spread's away
   side wins below -La, its home side wins above -Lb. A total's Over side
   (side A) wins above La, Under (side B) wins below Lb — no sign flip,
   since totals aren't home/away-relative. Both formulas reduce to the same
   existence test, La < Lb, once you track which side wins on which side of
   its own number. */
const middleWindow = (market, La, Lb) => {
  if (La == null || Lb == null || !isFinite(La) || !isFinite(Lb) || La === Lb) return null;
  let lo, hi;
  if (market === "sp") { lo = -Lb; hi = -La; } else { lo = La; hi = Lb; }
  const bothWin = La < Lb;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  return { lo, hi, width: hi - lo, bothWin };
};

return { SIG_M, toProb, toAmerican, payout, fmtOdds, devigPower, erf, normCdf, invNorm,
         round5, modelLine, trim, middleWindow };

});
