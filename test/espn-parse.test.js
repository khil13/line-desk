// Payloads below follow the shape of ESPN's public college-football JSON
// (scoreboard, summary, rankings), trimmed to the fields the parsers read.
// They were written by hand from that shape, not captured live — when a real
// response is saved, drop it in and these assertions should still hold.
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../lib/espn-parse.js");

const competitor = (homeAway, id, ab, name, color, extra = {}) => ({
  homeAway, team: { id, abbreviation: ab, shortDisplayName: name, color },
  records: [{ name: "overall", summary: "4-1" }, { name: "Home", summary: "3-0" },
            { name: "Road", summary: "1-1" }, { name: "vs. Conf.", summary: "2-1" }],
  ...extra,
});

const scoreboard = { events: [
  { id: "401", date: "2026-10-03T19:30:00Z", status: { type: { state: "pre", shortDetail: "10/3 - 3:30 PM" } },
    competitions: [{
      competitors: [
        competitor("home", "251", "TEX", "Texas", "BF5700", { curatedRank: { current: 3 } }),
        competitor("away", "201", "OU", "Oklahoma", "841617", { curatedRank: { current: 99 } })],
      odds: [{ details: "TEX -3.5", spread: -3.5, overUnder: 54.5, provider: { name: "ESPN BET" },
               homeTeamOdds: { moneyLine: -165 }, awayTeamOdds: { moneyLine: 140 } }],
      venue: { fullName: "Cotton Bowl" } }] },
  { id: "402", date: "2026-10-03T16:00:00Z", status: { type: { state: "in", shortDetail: "2nd 4:12" } },
    competitions: [{
      competitors: [
        competitor("home", "61", "UGA", "Georgia", "000000", { score: "14" }),
        competitor("away", "2", "AUB", "Auburn", "0C2340", { score: "10" })],
      situation: { possession: "61", downDistanceText: "2nd & 7 at AUB 33", possessionText: "AUB 33",
                   isRedZone: false, yardsToEndzone: 33, distance: 7, lastPlay: { text: "Run for 3" } } }] },
  { id: "403", date: "2026-10-03T00:00:00Z", status: { type: { state: "post", completed: true } },
    competitions: [{ competitors: [
      competitor("home", "1", "HOM", "Home", "", { score: "31" }),
      competitor("away", "3", "AWY", "Away", "zzz", { score: "" })] }] },
] };

test("parseBoard reads teams, ranks, records and splits", () => {
  const [g] = P.parseBoard(scoreboard);
  assert.equal(g.id, "espn-401");
  assert.equal(g.espnId, "401");
  assert.deepEqual([g.away, g.home, g.aAb, g.hAb], ["Oklahoma", "Texas", "OU", "TEX"]);
  assert.equal(g.hR, 3);
  assert.equal(g.aR, null, "a curatedRank of 99 means unranked");
  assert.equal(g.hRec, "4-1");
  assert.deepEqual(g.hSplits, { home: "3-0", road: "1-1", conf: "2-1" });
  assert.equal(g.state, "pre");
  assert.equal(g.venue, "Cotton Bowl");
  assert.equal(g.hs, null);
});

test("parseBoard reads ESPN's own line", () => {
  const o = P.parseBoard(scoreboard)[0].espnOdds;
  assert.equal(o.spread, -3.5);
  assert.equal(o.ou, 54.5);
  assert.equal(o.mlH, -165);
  assert.equal(o.mlA, 140);
  assert.equal(o.book, "ESPN BET");
});

test("parseBoard reads live scores and the field situation", () => {
  const g = P.parseBoard(scoreboard)[1];
  assert.equal(g.state, "in");
  assert.equal(g.hs, 14);
  assert.equal(g.as, 10);
  assert.equal(g.sit.y2e, 33);
  assert.equal(g.sit.dist, 7);
  assert.equal(g.sit.down, "2nd & 7 at AUB 33");
  assert.equal(g.sit.last, "Run for 3");
  assert.equal(g.espnOdds, null);
});

test("parseBoard treats a blank score as unknown and survives bad colours", () => {
  const g = P.parseBoard(scoreboard)[2];
  assert.equal(g.hs, 31);
  assert.equal(g.as, null);
  assert.equal(g.hColor, null);
  assert.equal(g.aColor, null);
  assert.equal(g.sit, null);
});

test("parseBoard returns nothing for an empty or missing payload", () => {
  assert.deepEqual(P.parseBoard({}), []);
  assert.deepEqual(P.parseBoard({ events: [] }), []);
});

const summary = {
  predictor: { homeTeam: { gameProjection: "71.4" }, awayTeam: { gameProjection: "28.6" } },
  pickcenter: [
    { provider: { name: "DraftKings" }, spread: -3.5, overUnder: 54.5, overOdds: -110, underOdds: -110,
      homeTeamOdds: { spreadOdds: -112, moneyLine: -170 }, awayTeamOdds: { spreadOdds: -108, moneyLine: 145 } },
    { provider: { name: "William Hill" }, spread: -3, overUnder: 55,
      homeTeamOdds: { moneyLine: -160 }, awayTeamOdds: { moneyLine: 135 } },
    { provider: { name: "Some Regional Book" }, spread: -4 },
    { provider: { name: "Props Only" } },
  ],
  injuries: [
    { team: { abbreviation: "TEX" }, injuries: [
      { athlete: { displayName: "A. Quarterback", position: { abbreviation: "QB" } }, status: "Out" },
      { athlete: {}, status: "Out" }] },
    { team: { abbreviation: "OU" }, injuries: [] },
  ],
  againstTheSpread: [{ team: { abbreviation: "TEX" }, records: [{ summary: "3-2-0" }] }],
  lastFiveGames: [{ team: { abbreviation: "OU" }, events: [
    { gameResult: "W", score: "31-17", opponent: { abbreviation: "TCU" } },
    { gameResult: "L", score: "20-24", opponent: { abbreviation: "BAY" } },
    { gameResult: "", score: "" }] }],
  gameInfo: { weather: { temperature: 41, displayValue: "Cloudy, wind 14 mph" },
              venue: { fullName: "Cotton Bowl", address: { city: "Dallas" } }, attendance: 92100 },
  seasonseries: [{ summary: "TEX leads 63-51-5" }],
};

test("parsePickcenter maps book names, falls back for unknown books, and skips empty rows", () => {
  const rows = P.parsePickcenter(summary, "TEX");
  assert.deepEqual(rows.map((r) => r.k), ["dk", "czr", "fd"]);
  const dk = rows[0];
  assert.equal(dk.sp, -3.5);
  assert.equal(dk.spB, -112, "spB is the home side");
  assert.equal(dk.spA, -108, "spA is the away side");
  assert.equal(dk.mlB, -170);
  assert.equal(dk.tot, 54.5);
  assert.equal(rows[1].ovr, null, "missing over price stays null, not -110");
  assert.equal(rows[2].name, "Some Regional Book");
  assert.equal(P.parsePickcenter({ pickcenter: [] }), null);
});

test("parseSummary reads ESPN's projection, injuries, ATS, form and series", () => {
  const d = P.parseSummary(summary, "TEX", "OU");
  assert.equal(d.espnWp, 71.4);
  assert.equal(d.pick.length, 3);
  assert.deepEqual(d.injuries, [{ ab: "TEX", list: [{ who: "A. Quarterback", pos: "QB", status: "Out" }] }]);
  assert.equal(d.hAts, "3-2-0");
  assert.equal(d.aAts, null);
  assert.deepEqual(d.aForm, [{ res: "W", score: "31-17", opp: "TCU" }, { res: "L", score: "20-24", opp: "BAY" }]);
  assert.equal(d.series, "TEX leads 63-51-5");
  assert.equal(d.city, "Dallas");
});

test("parseSummary pulls wind out of the weather text when there's no wind field", () => {
  const d = P.parseSummary(summary, "TEX", "OU");
  assert.equal(d.wind, 14);
  assert.deepEqual(d.weather, { t: 41, d: "Cloudy, wind 14 mph" });
  const calm = P.parseSummary({ gameInfo: { weather: { windSpeed: "6" } } }, "A", "B");
  assert.equal(calm.wind, 6);
  assert.equal(P.parseSummary({}, "A", "B").wind, null);
  assert.equal(P.parseSummary({}, "A", "B").espnWp, null);
});

test("parseLive reads both box scores and the latest win probability", () => {
  const j = {
    boxscore: { teams: [
      { team: { id: 61 }, statistics: [{ name: "totalYards", displayValue: "212" }] },
      { team: { id: 2 }, statistics: [{ name: "totalYards", displayValue: "180" }] }] },
    winprobability: [{ homeWinPercentage: 0.5 }, { homeWinPercentage: 0.64 }],
  };
  const live = P.parseLive(j, "61", "2");
  assert.equal(live.h.totalYards, "212");
  assert.equal(live.a.totalYards, "180");
  assert.equal(live.wp, 64);
  assert.equal(P.parseLive(j, "61", "999"), null);
});

test("parseRanks prefers the AP poll", () => {
  const r = P.parseRanks({ rankings: [
    { name: "Coaches Poll", shortName: "Coaches", ranks: [] },
    { name: "AP Top 25", shortName: "AP Poll", ranks: [
      { current: 1, team: { location: "Texas", nickname: "Longhorns", abbreviation: "TEX", color: "BF5700" },
        recordSummary: "5-0" }] }] });
  assert.equal(r.which, "AP Top 25");
  assert.deepEqual(r.teams.map((t) => [t.r, t.n, t.ab, t.rec]), [[1, "Texas Longhorns", "TEX", "5-0"]]);
  assert.equal(P.parseRanks({}), null);
});

test("parseDrives counts drives, plays, explosive plays and time per team", () => {
  const j = {
    boxscore: { teams: [{ team: { id: "61", abbreviation: "UGA" } }, { team: { id: "2", abbreviation: "AUB" } }] },
    drives: { previous: [
      { team: { id: "61" }, timeElapsed: { displayValue: "3:30" },
        plays: [{ statYardage: 4 }, { statYardage: 22 }, { statYardage: 15 }] },
      { team: { id: "2" }, timeElapsed: { displayValue: "1:05" }, plays: [{ statYardage: -3 }] },
      { team: { id: "61" }, timeElapsed: { displayValue: "0:40" }, plays: [{ statYardage: 60 }] },
      { team: { id: "999" }, plays: [{ statYardage: 80 }] }] },
  };
  const d = P.parseDrives(j);
  assert.deepEqual(d.UGA, { dr: 2, pl: 4, ex: 3, sec: 250, g: 1 });
  assert.deepEqual(d.AUB, { dr: 1, pl: 1, ex: 0, sec: 65, g: 1 });
  assert.equal(P.parseDrives({}), null);
});

test("legible lifts dark school colours and greys out blacks", () => {
  assert.equal(P.legible("#000000"), "#9AA5B5");
  assert.equal(P.legible("nope"), null);
  const navy = P.legible("#0C2340");
  assert.match(navy, /^#[0-9a-f]{6}$/);
  assert.notEqual(navy, "#0c2340");
});

test("footballWeek runs Thursday to Sunday, and Sunday belongs to the Saturday just gone", () => {
  const thu = P.footballWeek(new Date(2026, 9, 1, 12));   // Thu Oct 1 2026
  assert.deepEqual(thu.map((d) => d.v), ["20261001", "20261002", "20261003", "20261004"]);
  const sun = P.footballWeek(new Date(2026, 9, 4, 12));   // Sun Oct 4 2026
  assert.deepEqual(sun.map((d) => d.v), thu.map((d) => d.v));
  assert.equal(P.dayKey(new Date(2026, 0, 5)), "20260105");
});
