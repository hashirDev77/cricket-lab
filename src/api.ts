import { cricketGet } from "./lib/client";
import { asArray, asRecord, unwrapEvent, unwrapList, unwrapPlayer, unwrapTeam, unwrapTournament } from "./lib/unwrap";
import {
  groupSearch,
  hasScore,
  isLive,
  normalizeBall,
  normalizeInnings,
  normalizeMatch,
  normalizeMatches,
  normalizeOdds,
  normalizeOvers,
  normalizePlayer,
  normalizeSearch,
  normalizeSeason,
  normalizeStandings,
  normalizeTournament,
} from "./lib/normalize";
import type { CricketMatch, CricketPlayer } from "./lib/types";

export type Match = CricketMatch;
export type Player = CricketPlayer;

const IPL = 77922875;
const IPL_2026 = 81844788;

function widget(status: string, data: unknown, note?: string) {
  return { status, data, note };
}

export async function getHome() {
  const [fixtures, liveFeed] = await Promise.all([
    cricketGet("fixtures/today"),
    cricketGet("events", { status: "inprogress", limit: 20 }),
  ]);
  const byId = new Map<number, CricketMatch>();
  for (const match of [...normalizeMatches(fixtures.body), ...normalizeMatches(liveFeed.body)]) {
    byId.set(match.id, match);
  }

  const needScores = [...byId.values()].filter(
    (match) => isLive(match) && !hasScore(match.score.home) && !hasScore(match.score.away),
  );
  const details = await Promise.all(needScores.map((match) => cricketGet(`event/${match.id}`)));
  for (const detail of details) {
    const normalized = normalizeMatch(unwrapEvent(detail.body) || detail.body, "event");
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, {
      ...existing,
      ...normalized,
      tournament: {
        id: normalized.tournament.id ?? existing?.tournament.id ?? null,
        name: normalized.tournament.name ?? existing?.tournament.name ?? null,
      },
    });
  }

  const live: CricketMatch[] = [];
  const today: CricketMatch[] = [];
  const upcoming: CricketMatch[] = [];
  const completed: CricketMatch[] = [];
  for (const match of byId.values()) {
    const code = match.status.code.toLowerCase();
    if (isLive(match)) live.push(match);
    else if (code.includes("finish") || code.includes("complete")) completed.push(match);
    else upcoming.push(match);
    today.push(match);
  }
  return { live, today, upcoming, completed };
}

export async function getMatches(tab?: string) {
  const status = tab === "live" ? "inprogress" : tab === "results" ? "finished" : undefined;
  const [events, fixtures] = await Promise.all([
    cricketGet("events", { status, limit: 30 }),
    tab === "today" || !tab ? cricketGet("fixtures/today") : Promise.resolve({ status: 200, body: null }),
  ]);
  const list = normalizeMatches(events.body);
  const today = fixtures.body ? normalizeMatches(fixtures.body) : [];
  return {
    live: tab === "live" ? list : list.filter((match) => match.status.label === "Live"),
    today: today.length ? today : list,
    upcoming: list.filter((match) => match.status.label === "Upcoming"),
    results: tab === "results" ? list : list.filter((match) => match.status.label === "Completed"),
  };
}

export async function getMatch(id: number) {
  const [eventRes, periods, form, h2h, streaks, best] = await Promise.all([
    cricketGet(`event/${id}`),
    cricketGet(`event/${id}/period-scores`),
    cricketGet(`event/${id}/pregame-form`),
    cricketGet(`event/${id}/h2h`),
    cricketGet(`event/${id}/team-streaks`),
    cricketGet(`event/${id}/best-players`),
  ]);
  const match = normalizeMatch(unwrapEvent(eventRes.body) || eventRes.body, "event");
  if (!match) throw new Error("This information could not be loaded.");
  return {
    match,
    periodScores: asArray(periods.body?.periods),
    form: form.body,
    h2h: h2h.body,
    teamStreaks: streaks.body
      ? widget("SUPPORTED", streaks.body)
      : widget("EMPTY", null, "Team streak information is not available for this match."),
    bestPlayers: best.body
      ? widget("SUPPORTED", best.body)
      : widget("EMPTY", null, "Best player information is not available for this match."),
  };
}

export async function getScorecard(id: number) {
  const [eventRes, inningsRes, periods] = await Promise.all([
    cricketGet(`event/${id}`),
    cricketGet(`event/${id}/innings`),
    cricketGet(`event/${id}/period-scores`),
  ]);
  return {
    match: normalizeMatch(unwrapEvent(eventRes.body) || eventRes.body, "event"),
    innings: normalizeInnings(inningsRes.body),
    periodScores: asArray(periods.body?.periods),
  };
}

export async function getCommentary(id: number, cursor?: string) {
  const page = cursor ? Number(cursor) || 1 : 1;
  const result = await cricketGet(`event/${id}/ball-by-ball`, { page, limit: 50 });
  const balls = unwrapList(result.body).map(normalizeBall);
  const grouped = new Map<number | string, typeof balls>();
  for (const ball of balls) {
    const key = ball.over ?? "unknown";
    const list = grouped.get(key) || [];
    list.push(ball);
    grouped.set(key, list);
  }
  const hasMore = Boolean(result.body?.hasMore);
  return {
    overs: [...grouped.entries()].map(([over, items]) => ({ over, balls: items })),
    page,
    hasMore,
    nextCursor: hasMore ? String(page + 1) : null,
  };
}

export async function getOvers(id: number) {
  const result = await cricketGet(`event/${id}/overs`, { page: 1, limit: 80 });
  const overs = normalizeOvers(result.body);
  let runningRuns = 0;
  let runningWickets = 0;
  const progression = overs.map((over) => {
    runningRuns += over.runs || 0;
    runningWickets += over.wickets || 0;
    return { over: over.over, score: `${runningRuns}/${runningWickets}` };
  });
  return { overs, progression };
}

export async function getInsights(id: number) {
  const [h2h, form, best, streaks, enrichments] = await Promise.all([
    cricketGet(`event/${id}/h2h`),
    cricketGet(`event/${id}/pregame-form`),
    cricketGet(`event/${id}/best-players`),
    cricketGet(`event/${id}/team-streaks`),
    cricketGet(`event/${id}/enrichments`),
  ]);
  const types = asArray(enrichments.body?.types)
    .map((item) => {
      const rec = asRecord(item);
      return typeof item === "string" ? item : String(rec?.type || rec?.name || "");
    })
    .filter(Boolean);
  const typed = await Promise.all(
    types.slice(0, 5).map(async (type) => {
      const result = await cricketGet(`event/${id}/enrichments/${type}`);
      return { type, status: result.status, body: result.body };
    }),
  );
  return {
    components: {
      h2h: h2h.body ? widget("SUPPORTED", h2h.body) : widget("NO_DATA", null),
      form: form.body ? widget("SUPPORTED", form.body) : widget("NO_DATA", null),
      bestPlayers: best.body ? widget("SUPPORTED", best.body) : widget("OPTIONAL_404", null),
      teamStreaks: streaks.body ? widget("SUPPORTED", streaks.body) : widget("OPTIONAL_404", null),
      enrichments: types.length ? widget("SUPPORTED", types) : widget("EMPTY", []),
      typed: widget(typed.length ? "SUPPORTED" : "EMPTY", typed),
    },
  };
}

export async function getOdds(id: number) {
  const started = Date.now();
  const result = await cricketGet(`event/${id}/odds`);
  const markets = normalizeOdds(result.body);
  return { markets, responseTime: Date.now() - started };
}

export async function getSearch(q: string) {
  const result = await cricketGet("search", { q, page: 1, limit: 20 });
  const hits = normalizeSearch(result.body);
  const seen = new Set<string>();
  const unique = hits.filter((hit) => {
    const key = `${hit.type}:${hit.id}:${hit.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { query: q, ...groupSearch(unique) };
}

export async function getPlayer(id: number) {
  const result = await cricketGet(`player/${id}`);
  const player = normalizePlayer(unwrapPlayer(result.body) || result.body);
  if (!player) throw new Error("This information could not be loaded.");
  const rawMissing = (["team", "country", "role", "battingStyle", "bowlingStyle", "image"] as const).filter((key) => {
    const value = player[key];
    return value == null || (typeof value === "object" && value && "id" in value && value.id == null && !value.name);
  });
  return { player, rawMissing };
}

export async function getPlayerMatches(id: number) {
  const [last, next] = await Promise.all([
    cricketGet(`player/${id}/events/last`, { page: 1, limit: 10 }),
    cricketGet(`player/${id}/events/next`, { page: 1, limit: 10 }),
  ]);
  return { recent: normalizeMatches(last.body), upcoming: normalizeMatches(next.body) };
}

export async function getPlayerStatistics(id: number, tournamentId = IPL, seasonId = IPL_2026) {
  const result = await cricketGet(`player/${id}/unique-tournament/${tournamentId}/season/${seasonId}/statistics`);
  if (result.status === 404 || !result.body) {
    return { available: false, tournamentId, seasonId, batting: null, bowling: null, fielding: null };
  }
  const stats = asRecord(result.body.statistics) || asRecord(result.body) || {};
  const pick = (keys: string[]) => {
    const out: Record<string, unknown> = {};
    for (const key of keys) if (stats[key] != null) out[key] = stats[key];
    return Object.keys(out).length ? out : null;
  };
  return {
    available: true,
    tournamentId,
    seasonId,
    batting: pick(["matches", "innings", "runs", "average", "strikeRate", "hundreds", "fifties", "fours", "sixes", "highestScore"]),
    bowling: pick(["overs", "runs", "wickets", "average", "economy", "strikeRate", "bestFigures"]),
    fielding: pick(["catches", "stumpings", "runOuts"]),
  };
}

export async function getPlayers(page = 1) {
  const result = await cricketGet("players", { page, limit: 20 });
  return {
    items: unwrapList(result.body)
      .map((row) => normalizePlayer(row))
      .filter((row): row is CricketPlayer => Boolean(row)),
  };
}

export async function getTeam(id: number) {
  const [profile, near, featured] = await Promise.all([
    cricketGet(`team/${id}`),
    cricketGet(`team/${id}/near-events`),
    cricketGet(`team/${id}/featured-event`),
  ]);
  const team = asRecord(unwrapTeam(profile.body) || profile.body);
  if (!team) throw new Error("This information could not be loaded.");
  const featuredEvent = unwrapEvent(featured.body);
  return {
    team: {
      id,
      name: team.name,
      country: asRecord(team.country)?.name || team.country || null,
      logo: team.logo || team.image || null,
      managerId: asRecord(team.manager)?.id || team.managerId || null,
    },
    previousMatch: normalizeMatch(asRecord(near.body?.previousEvent), "event"),
    nextMatch: normalizeMatch(asRecord(near.body?.nextEvent), "event"),
    featuredEvent: featuredEvent ? normalizeMatch(featuredEvent, "event") : null,
  };
}

export async function getTeamMatches(id: number) {
  const [last, next] = await Promise.all([
    cricketGet(`team/${id}/events/last`, { page: 1, limit: 15 }),
    cricketGet(`team/${id}/events/next`, { page: 1, limit: 15 }),
  ]);
  return { results: normalizeMatches(last.body), fixtures: normalizeMatches(next.body) };
}

export async function getTeamSquad(id: number) {
  const result = await cricketGet(`team/${id}/players`);
  const players = unwrapList(result.body)
    .map((row) => normalizePlayer(row))
    .filter((row): row is CricketPlayer => Boolean(row));
  const roleGroup = (role: string | null) => {
    const value = (role || "").toLowerCase();
    if (value.includes("keep")) return "wicketkeepers";
    if (value.includes("all")) return "allRounders";
    if (value.includes("bowl")) return "bowlers";
    if (value.includes("bat")) return "batters";
    return "unknown";
  };
  return {
    players,
    grouped: {
      batters: players.filter((player) => roleGroup(player.role) === "batters"),
      wicketkeepers: players.filter((player) => roleGroup(player.role) === "wicketkeepers"),
      allRounders: players.filter((player) => roleGroup(player.role) === "allRounders"),
      bowlers: players.filter((player) => roleGroup(player.role) === "bowlers"),
      unknown: players.filter((player) => roleGroup(player.role) === "unknown"),
    },
  };
}

export async function getTeamPerformance(id: number) {
  const result = await cricketGet(`team/${id}/performance`);
  const body = result.body || {};
  return { events: asArray(body.events), points: body.points ?? null, raw: body };
}

export async function getTeamRankings(id: number) {
  const result = await cricketGet(`team/${id}/rankings`, { page: 1, limit: 20 });
  return { items: unwrapList(result.body) };
}

export async function getTeamCompetitions(id: number) {
  const result = await cricketGet(`team/${id}/unique-tournaments`, { page: 1, limit: 30 });
  return { items: unwrapList(result.body).map(normalizeTournament).filter(Boolean) };
}

export async function getTeamMedia(id: number) {
  const result = await cricketGet(`team/${id}/media`, { page: 1, limit: 20 });
  return { items: unwrapList(result.body) };
}

export async function getTeams(page = 1) {
  const result = await cricketGet("teams", { page, limit: 20 });
  return {
    items: unwrapList(result.body)
      .map((row) => {
        const rec = asRecord(row) || {};
        return { id: Number(rec.id), name: String(rec.name || rec.shortName || "") };
      })
      .filter((team) => team.id && team.name),
  };
}

export async function getManager(id: number) {
  const result = await cricketGet(`manager/${id}`);
  return { manager: result.body, status: result.status };
}

export async function getTournaments(page = 1) {
  const result = await cricketGet("tournaments", { page, limit: 30 });
  return { items: unwrapList(result.body).map(normalizeTournament).filter(Boolean) };
}

export async function getTournament(id: number) {
  const [profile, seasons, events] = await Promise.all([
    cricketGet(`unique-tournament/${id}`),
    cricketGet(`unique-tournament/${id}/seasons`, { page: 1, limit: 20 }),
    cricketGet(`unique-tournament/${id}/events`, { page: 1, limit: 10 }),
  ]);
  const tournament = normalizeTournament(unwrapTournament(profile.body) || profile.body);
  const seasonList = unwrapList(seasons.body)
    .map(normalizeSeason)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return {
    tournament,
    seasons: seasonList,
    currentSeasonId: tournament?.currentSeasonId ?? seasonList[0]?.id ?? null,
    matches: normalizeMatches(events.body),
  };
}

export async function getTournamentMatches(id: number, date?: string) {
  const result = date
    ? await cricketGet(`unique-tournament/${id}/scheduled-events/${date}`)
    : await cricketGet(`unique-tournament/${id}/events`, { page: 1, limit: 40 });
  const matches = normalizeMatches(result.body);
  const byDay = new Map<string, typeof matches>();
  for (const match of matches) {
    const day = match.startTime ? match.startTime.slice(0, 10) : "Unknown date";
    const list = byDay.get(day) || [];
    list.push(match);
    byDay.set(day, list);
  }
  return { days: [...byDay.entries()].map(([dateKey, items]) => ({ date: dateKey, matches: items })) };
}

export async function getTournamentSeasons(id: number) {
  const result = await cricketGet(`unique-tournament/${id}/seasons`, { page: 1, limit: 30 });
  return {
    seasons: unwrapList(result.body)
      .map(normalizeSeason)
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
  };
}

export async function getTournamentStandings(id: number, seasonId: number, type: "total" | "home" | "away" = "total") {
  const result = await cricketGet(`unique-tournament/${id}/season/${seasonId}/standings/${type}`);
  const rows = normalizeStandings(result.body);
  const columns = ["position", "team", "played", "won", "lost", "nrr", "points"].filter((col) =>
    rows.some((row) => (col === "team" ? row.team.name : (row as unknown as Record<string, unknown>)[col] != null)),
  );
  return { columns, rows };
}

export async function getTournamentLeaders(id: number, seasonId?: number) {
  return {
    available: false,
    message: "Tournament Leaders are not currently available through a dedicated Cricket endpoint.",
    candidate: `/unique-tournament/${id}/season/${seasonId || "{seasonId}"}/leaders`,
  };
}