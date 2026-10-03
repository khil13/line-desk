/* ESPN parsing: turns the public, undocumented ESPN JSON (scoreboard, summary,
   rankings) into the plain objects the app works with, plus the small helpers
   those parsers lean on (team-colour legibility, kickoff formatting, the
   football week). Pure — no fetching, no DOM, no React. ESPN can change these
   shapes without notice, which is exactly why they live here: the tests feed
   them saved payloads and fail when a field moves. index.html loads this as a
   plain <script> global (window.EspnParse); ncaaf-line-desk.jsx and the tests
   require() it. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.EspnParse = mod;
})(typeof self !== "undefined" ? self : this, function () {

/* ESPN ships real school colors, but plenty are near-black or deep navy
   and vanish on this background. Lift lightness only as far as needed. */
const legible = (hex) => {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return null;
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16) / 255,
      g = parseInt(h.slice(2, 4), 16) / 255,
      b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0, sn = 0; const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d) {
    sn = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh /= 6;
  }
  if (sn < 0.12) return "#9AA5B5";              // greys and blacks
  const nl = l < 0.46 ? 0.58 : l > 0.82 ? 0.74 : l;
  const ns = Math.max(sn, 0.45);
  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns, pq = 2 * nl - q;
  const cv = (t) => {
    t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (t < 1 / 6) return pq + (q - pq) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return pq + (q - pq) * (2 / 3 - t) * 6;
    return pq;
  };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + to(cv(hh + 1 / 3)) + to(cv(hh)) + to(cv(hh - 1 / 3));
};

/* The football week around whatever today is. Hardcoding these once pinned
   the whole app to the week it was built in. */
const dayKey = (d) =>
  d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") +
  String(d.getDate()).padStart(2, "0");

const footballWeek = (now) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                       // 0 Sun … 6 Sat
  const sat = new Date(d);
  // Sunday belongs to the Saturday just gone, not the one coming.
  sat.setDate(d.getDate() + (dow === 0 ? -1 : (6 - dow)));
  const names = ["Thu", "Fri", "Sat", "Sun"];
  return [-2, -1, 0, 1].map((off, i) => {
    const x = new Date(sat); x.setDate(sat.getDate() + off);
    return { v: dayKey(x), l: names[i] + " " + x.getDate(), iso: x };
  });
};

const fmtKick = (iso) => {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch (e) { return ""; }
};

// ESPN returns overall, home, road and conference records in one array.
const splitsOf = (side) => {
  const out = {};
  for (const rec of (side || {}).records || []) {
    const k = (rec.name || rec.type || "").toLowerCase();
    if (!rec.summary) continue;
    if (k.includes("home")) out.home = rec.summary;
    else if (k.includes("road") || k.includes("away")) out.road = rec.summary;
    else if (k.includes("conf")) out.conf = rec.summary;
  }
  return Object.keys(out).length ? out : null;
};

const parseBoard = (j) =>
  (j.events || []).map((ev) => {
    const c = (ev.competitions || [])[0] || {};
    const cs = c.competitors || [];
    const H = cs.find((x) => x.homeAway === "home") || {};
    const A = cs.find((x) => x.homeAway === "away") || {};
    const od = (c.odds || [])[0] || null;
    const st = (ev.status && ev.status.type) || {};
    const rank = (x) => {
      const r = x.curatedRank && x.curatedRank.current;
      return r && r > 0 && r <= 25 ? r : null;
    };
    return {
      id: "espn-" + ev.id,
      espnId: ev.id,
      kickAt: ev.date,
      kick: fmtKick(ev.date),
      home: (H.team || {}).shortDisplayName || (H.team || {}).displayName || "Home",
      away: (A.team || {}).shortDisplayName || (A.team || {}).displayName || "Away",
      hAb: (H.team || {}).abbreviation || "HOME",
      aAb: (A.team || {}).abbreviation || "AWAY",
      hColor: legible("#" + ((H.team || {}).color || "")),
      aColor: legible("#" + ((A.team || {}).color || "")),
      hRec: ((H.records || [])[0] || {}).summary || null,
      aRec: ((A.records || [])[0] || {}).summary || null,
      hSplits: splitsOf(H), aSplits: splitsOf(A),
      hR: rank(H), aR: rank(A),
      hs: H.score != null && H.score !== "" ? Number(H.score) : null,
      as: A.score != null && A.score !== "" ? Number(A.score) : null,
      state: st.state || "pre",
      detail: st.shortDetail || "",
      hId: (H.team || {}).id || null,
      aId: (A.team || {}).id || null,
      sit: (() => {
        const q = c.situation;
        if (!q) return null;
        // yardsToEndzone is how far the offense still has to go — unlike
        // yardLine, it already accounts for who has the ball, so it's the
        // one safe to use for the field diagram. Unverified against a live
        // payload; if ESPN's field name turns out different the diagram
        // just won't draw (y2e stays null) and the text line still shows.
        const y2e = typeof q.yardsToEndzone === "number" ? q.yardsToEndzone : null;
        const dist = typeof q.distance === "number" ? q.distance : null;
        return {
          poss: q.possession || null,
          down: q.downDistanceText || q.shortDownDistanceText || null,
          spot: q.possessionText || null,
          red: !!q.isRedZone,
          last: (q.lastPlay || {}).text || null,
          y2e, dist,
        };
      })(),
      venue: (c.venue || {}).fullName || null,
      wp: null,
      espnOdds: od
        ? { details: od.details || (od.spread != null
              ? ((H.team || {}).abbreviation || "H") + " " + (od.spread > 0 ? "+" : "") + od.spread
              : null),
            ou: od.overUnder != null ? Number(od.overUnder) : null,
            spread: od.spread != null ? Number(od.spread) : null,
            mlH: (od.homeTeamOdds || {}).moneyLine ?? null,
            mlA: (od.awayTeamOdds || {}).moneyLine ?? null,
            book: (od.provider || {}).name || "ESPN" }
        : null,
    };
  });

const BOOK_MATCH = [
  ["dk", /draft ?kings/i], ["fd", /fan ?duel/i], ["mgm", /bet ?mgm/i],
  ["czr", /caesar|william hill/i], ["pin", /pinnacle/i],
];

/* /summary?event=ID returns pickcenter — the same game priced by several
   books. Free, and it fills the shopping grid without a single paid call. */
const parsePickcenter = (j, hAb) => {
  const rows = (j.pickcenter || []).filter((o) => o && (o.spread != null || o.overUnder != null));
  if (!rows.length) return null;
  const used = new Set();
  const out = [];
  for (const o of rows) {
    const name = ((o.provider || {}).name || "").trim();
    let key = (BOOK_MATCH.find(([, re]) => re.test(name)) || [])[0];
    if (!key || used.has(key)) {
      key = ["dk", "fd", "mgm", "czr", "pin"].find((k) => !used.has(k));
      if (!key) continue;
    }
    used.add(key);
    const hO = o.homeTeamOdds || {}, aO = o.awayTeamOdds || {};
    out.push({
      k: key, name: name || "Book",
      sp: o.spread != null ? Number(o.spread) : null,
      spA: aO.spreadOdds != null ? Number(aO.spreadOdds) : null,
      spB: hO.spreadOdds != null ? Number(hO.spreadOdds) : null,
      tot: o.overUnder != null ? Number(o.overUnder) : null,
      ovr: o.overOdds != null ? Number(o.overOdds) : null,
      und: o.underOdds != null ? Number(o.underOdds) : null,
      mlA: aO.moneyLine != null ? Number(aO.moneyLine) : null,
      mlB: hO.moneyLine != null ? Number(hO.moneyLine) : null,
    });
  }
  return out.length ? out : null;
};

/* One /summary call carries the whole picture: odds by book, ESPN's own
   projection, injuries, ATS records, recent form, weather, head-to-head. */
const parseSummary = (j, hAb, aAb) => {
  const pick = parsePickcenter(j, hAb);
  const pr = j.predictor || {};
  const proj = (x) => {
    const v = parseFloat((x || {}).gameProjection);
    return isFinite(v) ? v : null;
  };
  const inj = (j.injuries || []).map((t) => ({
    ab: ((t.team || {}).abbreviation) || "",
    list: (t.injuries || []).map((i) => ({
      who: ((i.athlete || {}).displayName) || "",
      pos: (((i.athlete || {}).position) || {}).abbreviation || "",
      status: i.status || "",
    })).filter((x) => x.who),
  })).filter((t) => t.list.length);

  const atsOf = (ab) => {
    const t = (j.againstTheSpread || []).find(
      (x) => ((x.team || {}).abbreviation) === ab);
    if (!t) return null;
    const r = (t.records || [])[0];
    return r ? (r.summary || null) : null;
  };
  const formOf = (ab) => {
    const t = (j.lastFiveGames || []).find(
      (x) => ((x.team || {}).abbreviation) === ab);
    if (!t) return null;
    return (t.events || []).slice(0, 5).map((e) => ({
      res: e.gameResult || "", score: e.score || "", opp: e.opponent
        ? ((e.opponent.abbreviation) || "") : "",
    })).filter((x) => x.res);
  };

  const gi = j.gameInfo || {};
  const w = gi.weather || {};
  return {
    pick,
    espnWp: proj(pr.homeTeam),
    injuries: inj,
    hAts: atsOf(hAb), aAts: atsOf(aAb),
    hForm: formOf(hAb), aForm: formOf(aAb),
    wind: (() => {
      // ESPN puts wind in different places depending on the feed, and often
      // not at all. Read it where it exists, otherwise say so.
      const direct = w.windSpeed ?? w.gust ?? null;
      if (direct != null && isFinite(Number(direct))) return Number(direct);
      const m = /(\d{1,2})\s*mph/i.exec(w.displayValue || "");
      return m ? Number(m[1]) : null;
    })(),
    weather: w.temperature != null || w.displayValue
      ? { t: w.temperature ?? w.highTemperature ?? null, d: w.displayValue || "" } : null,
    venue: (gi.venue || {}).fullName || null,
    city: ((gi.venue || {}).address || {}).city || null,
    attendance: gi.attendance || null,
    series: (((j.seasonseries || [])[0] || {}).summary) || null,
  };
};

const STATKEYS = [
  ["totalYards", "Total yards"], ["netPassingYards", "Passing"],
  ["rushingYards", "Rushing"], ["firstDowns", "First downs"],
  ["thirdDownEff", "Third down"], ["turnovers", "Turnovers"],
  ["possessionTime", "Possession"], ["totalPenaltiesYards", "Penalties"],
];

const parseLive = (j, hId, aId) => {
  const teams = ((j.boxscore || {}).teams) || [];
  if (!teams.length) return null;
  const pick = (t) => {
    const out = {};
    for (const st of t.statistics || []) out[st.name] = st.displayValue;
    return out;
  };
  const H = teams.find((t) => String((t.team || {}).id) === String(hId));
  const A = teams.find((t) => String((t.team || {}).id) === String(aId));
  if (!H || !A) return null;
  const wp = j.winprobability;
  const lastWp = Array.isArray(wp) && wp.length
    ? wp[wp.length - 1].homeWinPercentage : null;
  return { h: pick(H), a: pick(A),
           wp: lastWp != null ? lastWp * 100 : null };
};

const parseRanks = (j) => {
  const ap = (j.rankings || []).find((r) => /ap/i.test(r.shortName || r.name || "")) ||
             (j.rankings || [])[0];
  if (!ap) return null;
  return {
    which: ap.name || "AP Top 25",
    teams: (ap.ranks || []).map((r) => ({
      r: r.current,
      n: ((r.team || {}).nickname && (r.team || {}).location)
        ? (r.team.location + " " + r.team.nickname) : ((r.team || {}).name || ""),
      ab: (r.team || {}).abbreviation || "",
      rec: r.recordSummary || "",
      c: legible("#" + ((r.team || {}).color || "")),
    })),
  };
};

/* Drive-by-drive data from a finished game. This is where pace, possessions
   and explosive plays actually come from — the box score alone can't give
   them. One call per game, which is why it's a separate, slower scan. */
function parseDrives(j) {
  const drives = ((j.drives || {}).previous) || [];
  if (!drives.length) return null;

  // Map ESPN team ids to abbreviations via the box score.
  const abbr = {};
  for (const t of ((j.boxscore || {}).teams) || []) {
    const id = String(((t.team || {}).id) || "");
    const ab = (t.team || {}).abbreviation;
    if (id && ab) abbr[id] = ab;
  }

  const out = {};
  const bump = (ab, k, v) => {
    if (!ab) return;
    out[ab] = out[ab] || { dr: 0, pl: 0, ex: 0, sec: 0, g: 1 };
    out[ab][k] += v;
  };

  for (const d of drives) {
    const ab = abbr[String(((d.team || {}).id) || "")];
    if (!ab) continue;
    bump(ab, "dr", 1);
    const plays = d.plays || [];
    bump(ab, "pl", plays.length);
    for (const pl of plays) {
      const y = Number(pl.statYardage);
      if (isFinite(y) && y >= 15) bump(ab, "ex", 1);
    }
    const m = /^(\d+):(\d{2})$/.exec(((d.timeElapsed || {}).displayValue) || "");
    if (m) bump(ab, "sec", Number(m[1]) * 60 + Number(m[2]));
  }
  return Object.keys(out).length ? out : null;
}

return { legible, dayKey, footballWeek, fmtKick, splitsOf, parseBoard, BOOK_MATCH, parsePickcenter, parseSummary, STATKEYS, parseLive, parseRanks, parseDrives };

});
