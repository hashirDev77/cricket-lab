import { asArray, asRecord, unwrapEvent, unwrapList, unwrapPlayer, unwrapTournament } from "../raw/unwrap.js";
import type { Json } from "../raw/types.js";
import type { RequestContext } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import type {
  CricketBall,
  CricketBatterRow,
  CricketBowlerRow,
  CricketInnings,
  CricketMatch,
  CricketOddsMarket,
  CricketPlayer,
  CricketScore,
  CricketSeason,
  CricketStanding,
  CricketStatus,
  CricketTeamRef,
  CricketTournament,
  CricketTournamentRef,
  SearchHit,
} from "./models.js";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function idOf(value: unknown): number | null {
  const rec = asRecord(value);
  return num(rec?.id ?? value);
}

function teamRef(value: unknown): CricketTeamRef {
  const rec = asRecord(value) || {};
  return {
    id: num(rec.id),
    name: str(rec.name) || str(rec.shortName),
    shortName: str(rec.shortName) || str(rec.nameCode),
    country: str(asRecord(rec.country)?.name) || str(rec.country),
    logo: str(rec.logo) || str(rec.image) || str(rec.crest),
  };
}

export function normalizeStatus(raw: unknown, ctx?: RequestContext, endpoint?: string): CricketStatus {
  if (typeof raw === "string") {
    store.addSchemaNote({
      endpoint: endpoint || "list",
      field: "status",
      observed: "string",
      canonical: "object { code, label }",
    });
    ctx?.recordGap({
      code: "SCHEMA_INCONSISTENCY",
      type: "SCHEMA_INCONSISTENCY",
      severity: "P1",
      endpoint: endpoint || "list",
      field: "status",
      expected: "status object { code, description }",
      actual: "string",
      userImpact: "List and detail cannot share one status renderer.",
      developerImpact: "Clients must branch on typeof status.",
      recommendation: "Use a common status object on list and detail.",
    });
    return { code: raw, label: labelForStatus(raw), description: raw };
  }
  const rec = asRecord(raw) || {};
  const code = str(rec.code) || str(rec.type) || str(rec.description) || "unknown";
  const description = str(rec.description);
  return { code, label: labelForStatus(code, description), description };
}

function labelForStatus(code: string, description?: string | null): string {
  const value = `${code} ${description || ""}`.toLowerCase();
  if (
    value.includes("inprogress") ||
    value.includes("live") ||
    value.includes("inning") ||
    value.includes("break") ||
    ["7", "13", "21", "31", "32", "45"].includes(code)
  ) {
    return "Live";
  }
  if (value.includes("notstarted") || value.includes("upcoming") || code === "0") return "Upcoming";
  if (value.includes("finished") || value.includes("complete") || ["100", "110"].includes(code)) return "Completed";
  if (value.includes("cancel")) return "Cancelled";
  if (value.includes("postpon")) return "Postponed";
  return description || code;
}

export function normalizeTimestamp(raw: unknown, ctx?: RequestContext, endpoint?: string): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    store.addSchemaNote({
      endpoint: endpoint || "list",
      field: "startTimestamp",
      observed: "integer unix seconds",
      canonical: "ISO-8601 string",
    });
    ctx?.recordGap({
      code: "SCHEMA_INCONSISTENCY",
      type: "SCHEMA_INCONSISTENCY",
      severity: "P1",
      endpoint: endpoint || "list",
      field: "startTimestamp",
      expected: "ISO-8601 string",
      actual: "integer unix seconds",
      userImpact: "Start times render inconsistently across screens.",
      developerImpact: "List and detail use different timestamp types.",
      recommendation: "Use one UTC representation on every event payload.",
    });
    return new Date(raw * 1000).toISOString();
  }
  const text = String(raw);
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    if (seconds > 1e9) return new Date(seconds * 1000).toISOString();
  }
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return text;
}

function scoreFromBlock(block: unknown, source: CricketScore["source"]): CricketScore {
  const rec = asRecord(block) || {};
  const innings = asRecord(rec.innings) || {};
  const firstInning = asRecord(Object.values(innings)[0]) || {};
  const runs = num(firstInning.score) ?? num(rec.display) ?? num(rec.current) ?? num(rec.runs);
  const wickets = num(firstInning.wickets) ?? num(rec.wickets);
  const overs = num(firstInning.overs) ?? num(rec.overs);
  const display =
    runs != null ? `${runs}${wickets != null ? `/${wickets}` : ""}` : str(rec.display);
  return {
    runs,
    wickets,
    overs,
    display,
    runRate: num(firstInning.runRate) ?? num(rec.runRate),
    source: runs == null && wickets == null ? "missing" : source,
  };
}

export function hasScore(score: CricketScore): boolean {
  return score.runs != null || (score.display != null && score.display !== "0" && score.source !== "missing");
}

export function normalizeMatch(raw: unknown, ctx?: RequestContext, source: "list" | "event" = "event"): CricketMatch | null {
  const rec = asRecord(raw) || unwrapEvent(asRecord(raw));
  if (!rec || rec.id == null) return null;
  const tournamentRaw = asRecord(rec.uniqueTournament) || asRecord(rec.tournament);
  const tournament: CricketTournamentRef = {
    id: num(tournamentRaw?.id) ?? num(rec.tournamentId) ?? num(rec.uniqueTournamentId),
    name: str(tournamentRaw?.name) || str(rec.tournamentName),
  };
  if (source === "event" && tournamentRaw && tournamentRaw.id == null && rec.tournamentId == null) {
    ctx?.recordGap({
      code: "BROKEN_RELATIONSHIP",
      type: "BROKEN_RELATIONSHIP",
      severity: "P1",
      endpoint: "/event/{id}",
      field: "uniqueTournament.id",
      expected: "numeric tournament id",
      actual: "null",
      fallback: "list tournamentId if previously seen",
      userImpact: "Cannot reliably navigate match → tournament.",
      developerImpact: "Detail drops the id that list already provided.",
      recommendation: "Always set uniqueTournament.id when a name is present.",
    });
  }
  const home = scoreFromBlock(rec.homeScore, source);
  const away = scoreFromBlock(rec.awayScore, source);
  const status = normalizeStatus(rec.status ?? rec.statusType, ctx, source === "list" ? "/events" : "/event/{id}");
  const startTime = normalizeTimestamp(rec.startTimestamp ?? rec.startTime, ctx, source === "list" ? "/events" : "/event/{id}");
  const inningsLabel = str(asRecord(rec.status)?.description) || str(rec.description);
  const currentOvers = home.overs ?? away.overs;
  return {
    id: Number(rec.id),
    status,
    startTime,
    tournament,
    homeTeam: teamRef(rec.homeTeam),
    awayTeam: teamRef(rec.awayTeam),
    score: { home, away },
    currentInnings: inningsLabel || currentOvers != null
      ? { label: inningsLabel, overs: currentOvers, battingTeamId: null }
      : null,
    venue: str(asRecord(rec.venue)?.name) || str(rec.venue),
    format: str(rec.groundType) || str(rec.format) || str(asRecord(rec.tournament)?.category),
    result: str(rec.winnerCode) || str(rec.note) || (status.code.toLowerCase().includes("finish") ? status.description ?? null : null),
  };
}

export function normalizeMatches(body: Json | null, ctx?: RequestContext, source: "list" | "event" = "list"): CricketMatch[] {
  return unwrapList(body)
    .map((item) => normalizeMatch(item, ctx, source))
    .filter((item): item is CricketMatch => Boolean(item));
}

export function normalizePlayer(raw: unknown): CricketPlayer | null {
  const rec = asRecord(raw) || unwrapPlayer(asRecord(raw));
  if (!rec || rec.id == null) return null;
  const team = asRecord(rec.team) || asRecord(rec.currentTeam);
  return {
    id: Number(rec.id),
    name: str(rec.name) || [str(rec.firstName), str(rec.lastName)].filter(Boolean).join(" ") || null,
    team: team ? teamRef(team) : null,
    country: str(asRecord(rec.country)?.name) || str(rec.country) || str(rec.nationality),
    role: str(rec.position) || str(rec.role) || str(asRecord(rec.playerTeamInfo)?.position),
    battingStyle: str(rec.battingStyle) || str(rec.battingHand),
    bowlingStyle: str(rec.bowlingStyle) || str(rec.bowlingArm),
    image: str(rec.image) || str(rec.photo) || str(rec.logo),
  };
}

export function normalizeTournament(raw: unknown): CricketTournament | null {
  const rec = asRecord(raw) || unwrapTournament(asRecord(raw));
  if (!rec || rec.id == null) return null;
  return {
    id: Number(rec.id),
    name: str(rec.name),
    country: str(asRecord(rec.category)?.name) || str(asRecord(rec.country)?.name) || str(rec.country),
    category: str(asRecord(rec.category)?.name) || str(rec.category),
    logo: str(rec.logo) || str(rec.image),
    currentSeasonId: num(asRecord(rec.currentSeason)?.id) ?? num(rec.currentSeasonId),
    active: typeof rec.active === "boolean" ? rec.active : null,
  };
}

export function normalizeSeason(raw: unknown): CricketSeason | null {
  const rec = asRecord(raw);
  if (!rec || rec.id == null) return null;
  return { id: Number(rec.id), name: str(rec.name) || str(rec.year), year: str(rec.year) || str(rec.name) };
}

export function classify(value: unknown, derived = false): "AVAILABLE" | "DERIVED" | "MISSING" | "NULL" {
  if (derived && value != null) return "DERIVED";
  if (value === undefined) return "MISSING";
  if (value === null) return "NULL";
  return "AVAILABLE";
}

export function normalizeInnings(body: Json | null): CricketInnings[] {
  const innings = asArray(body?.innings);
  const players = asArray(body?.players);
  return innings.map((item, index) => {
    const rec = asRecord(item) || {};
    const battingRaw = asArray(rec.batting) || asArray(rec.batsmen) || asArray(rec.batters);
    const bowlingRaw = asArray(rec.bowling) || asArray(rec.bowlers);
    const battingSource = battingRaw.length ? battingRaw : players.filter((player) => {
      const row = asRecord(player) || {};
      return row.runs != null || row.batting != null || asRecord(row.statistics)?.runs != null;
    });
    const bowlingSource = bowlingRaw.length ? bowlingRaw : players.filter((player) => {
      const row = asRecord(player) || {};
      return row.wickets != null || row.bowling != null || asRecord(row.statistics)?.wickets != null;
    });
    const batting = battingSource.map(normalizeBatter);
    const bowling = bowlingSource.map(normalizeBowler);
    const extrasRec = asRecord(rec.extras) || {};
    const extras = {
      wides: num(extrasRec.wides) ?? num(rec.wides),
      noBalls: num(extrasRec.noBalls) ?? num(rec.noBalls),
      byes: num(extrasRec.byes) ?? num(rec.byes),
      legByes: num(extrasRec.legByes) ?? num(rec.legByes),
      penalty: num(extrasRec.penalty) ?? num(rec.penalty),
      total: num(extrasRec.total) ?? num(rec.extraRuns),
    };
    const fow = asArray(rec.fallOfWickets || rec.wicketsFallen).map((row) => {
      const itemRow = asRecord(row) || {};
      return {
        wicket: num(itemRow.wicket) ?? num(itemRow.order),
        score: num(itemRow.score) ?? num(itemRow.runs),
        player: str(itemRow.player) || str(asRecord(itemRow.player)?.name),
      };
    });
    const partnerships = asArray(rec.partnerships).map((row) => {
      const itemRow = asRecord(row) || {};
      const a = str(asRecord(itemRow.player1)?.name) || str(itemRow.player1);
      const b = str(asRecord(itemRow.player2)?.name) || str(itemRow.player2);
      return {
        players: [a, b].filter(Boolean).join(" + ") || "Unknown pair",
        runs: num(itemRow.runs),
        balls: num(itemRow.balls),
      };
    });
    const fields: CricketInnings["fields"] = {
      runs: classify(num(rec.score) ?? num(rec.runs)),
      balls: classify(num(rec.balls)),
      strikeRate: batting.some((row) => row.strikeRate != null && row.runs != null && row.balls != null)
        ? "DERIVED"
        : classify(batting.find((row) => row.strikeRate != null)?.strikeRate),
      dismissal: batting.some((row) => row.dismissal) ? "AVAILABLE" : "MISSING",
      fielderId: "MISSING",
      partnership: partnerships.length ? "AVAILABLE" : "MISSING",
      extras: extras.total != null || extras.wides != null ? "AVAILABLE" : "MISSING",
    };
    return {
      id: (rec.id as number | string | null) ?? index,
      teamId: num(asRecord(rec.team)?.id) ?? num(rec.teamId),
      teamName: str(asRecord(rec.team)?.name) || str(rec.teamName),
      runs: num(rec.score) ?? num(rec.runs),
      wickets: num(rec.wickets),
      overs: num(rec.overs),
      batting,
      bowling,
      extras,
      fallOfWickets: fow,
      partnerships,
      fields,
    };
  });
}

function normalizeBatter(raw: unknown): CricketBatterRow {
  const rec = asRecord(raw) || {};
  const stats = asRecord(rec.statistics) || asRecord(rec.batting) || rec;
  const runs = num(stats.runs);
  const balls = num(stats.balls);
  const strikeRate = num(stats.strikeRate) ?? (runs != null && balls ? Number(((runs / balls) * 100).toFixed(1)) : null);
  return {
    playerId: num(asRecord(rec.player)?.id) ?? num(rec.playerId) ?? num(rec.id),
    name: str(asRecord(rec.player)?.name) || str(rec.name),
    dismissal: str(rec.dismissal) || str(rec.howOut) || str(stats.dismissal),
    runs,
    balls,
    fours: num(stats.fours) ?? num(stats["4s"]),
    sixes: num(stats.sixes) ?? num(stats["6s"]),
    strikeRate,
  };
}

function normalizeBowler(raw: unknown): CricketBowlerRow {
  const rec = asRecord(raw) || {};
  const stats = asRecord(rec.statistics) || asRecord(rec.bowling) || rec;
  const overs = num(stats.overs);
  const runs = num(stats.runs);
  const economy = num(stats.economy) ?? (overs && runs != null ? Number((runs / overs).toFixed(2)) : null);
  return {
    playerId: num(asRecord(rec.player)?.id) ?? num(rec.playerId) ?? num(rec.id),
    name: str(asRecord(rec.player)?.name) || str(rec.name),
    overs,
    maidens: num(stats.maidens),
    runs,
    wickets: num(stats.wickets),
    economy,
    wides: num(stats.wides),
    noBalls: num(stats.noBalls),
  };
}

export function normalizeBall(raw: unknown): CricketBall {
  const rec = asRecord(raw) || {};
  return {
    over: num(rec.over) ?? num(rec.overNumber),
    ball: num(rec.ball) ?? num(rec.ballNumber),
    batter: str(asRecord(rec.batsman)?.name) || str(asRecord(rec.batter)?.name) || str(rec.batsmanName),
    batterId: num(asRecord(rec.batsman)?.id) ?? num(asRecord(rec.batter)?.id),
    bowler: str(asRecord(rec.bowler)?.name) || str(rec.bowlerName),
    bowlerId: num(asRecord(rec.bowler)?.id),
    runs: num(rec.runs) ?? num(rec.score),
    extras: str(rec.extras) || str(rec.extraType),
    wicket: rec.wicket === true || rec.isWicket === true || Boolean(rec.dismissal),
    dismissalType: str(rec.dismissalType) || str(rec.wicketType),
    fielder: str(asRecord(rec.fielder)?.name) || str(rec.fielder),
    scoreAfter: str(rec.scoreAfter) || str(rec.scoreText),
    commentary: str(rec.commentary) || str(rec.text) || str(rec.description),
    timestamp: str(rec.timestamp) || str(rec.time),
  };
}

export function normalizeOvers(body: Json | null) {
  return unwrapList(body).map((row) => {
    const rec = asRecord(row) || {};
    return {
      over: num(rec.over) ?? num(rec.overNumber) ?? num(rec.number),
      runs: num(rec.runs) ?? num(rec.score),
      wickets: num(rec.wickets),
      balls: asArray(rec.balls).map((ball) => str(asRecord(ball)?.result) || str(ball)),
      bowler: str(asRecord(rec.bowler)?.name) || str(rec.bowler),
      teamTotal: str(rec.teamTotal) || str(rec.scoreAfter),
      inningsId: rec.inningsId ?? rec.inningId ?? null,
    };
  });
}

export function normalizeStandings(body: Json | null): CricketStanding[] {
  const standings = asArray(body?.standings);
  const rows = standings.flatMap((group) => asArray(asRecord(group)?.rows));
  return rows.map((row) => {
    const rec = asRecord(row) || {};
    return {
      position: num(rec.position) ?? num(rec.rank),
      team: teamRef(rec.team),
      played: num(rec.matches) ?? num(rec.played) ?? num(rec.p),
      won: num(rec.wins) ?? num(rec.won) ?? num(rec.w),
      lost: num(rec.losses) ?? num(rec.lost) ?? num(rec.l),
      nrr: num(rec.nrr) ?? num(rec.netRunRate),
      points: num(rec.points) ?? num(rec.pts),
      raw: rec,
    };
  });
}

export function normalizeOdds(body: Json | null): CricketOddsMarket[] {
  return asArray(body?.markets).map((market) => {
    const rec = asRecord(market) || {};
    const selections = asArray(rec.choices || rec.selections || rec.outcomes).map((choice) => {
      const item = asRecord(choice) || {};
      return {
        name: str(item.name) || str(item.label),
        price: (item.odd ?? item.price ?? item.decimal) as number | string | null,
      };
    });
    return { name: str(rec.marketName) || str(rec.name), status: str(rec.status), selections };
  });
}

export function normalizeSearch(body: Json | null): SearchHit[] {
  return unwrapList(body).map((row) => {
    const rec = asRecord(row) || {};
    const rawType = str(rec.type) || str(rec.entityType) || "";
    const type =
      rawType.toLowerCase().includes("player")
        ? "player"
        : rawType.toLowerCase().includes("team")
          ? "team"
          : rawType.toLowerCase().includes("tournament")
            ? "tournament"
            : "unknown";
    return {
      type,
      id: num(rec.id),
      name: str(rec.name),
      image: str(rec.image) || str(rec.logo),
      country: str(asRecord(rec.country)?.name) || str(rec.country),
      team: str(asRecord(rec.team)?.name),
      competition: str(asRecord(rec.uniqueTournament)?.name),
    };
  });
}

export function groupSearch(hits: SearchHit[]) {
  return {
    players: hits.filter((hit) => hit.type === "player"),
    teams: hits.filter((hit) => hit.type === "team"),
    competitions: hits.filter((hit) => hit.type === "tournament"),
    other: hits.filter((hit) => hit.type === "unknown"),
  };
}

export { teamRef, num, str };
