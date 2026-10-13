import { CricketClient } from "../raw/client.js";
import { unwrapList, unwrapTournament } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { normalizeMatches, normalizeSeason, normalizeStandings, normalizeTournament } from "../normalize/entities.js";

export async function loadTournaments(page = 1) {
  const ctx = new RequestContext("Tournament pages", "directory");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.tournaments(page, 30, { screen: "Tournament pages", component: "directory" });
  return {
    items: unwrapList(result.body).map(normalizeTournament).filter(Boolean),
    page,
    total: result.body?.total ?? 0,
    hasMore: Boolean(result.body?.hasMore),
    audit: "AUDIT REQUIRED",
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournament(tournamentId: number) {
  const ctx = new RequestContext("Tournament pages", "overview");
  ctx.minimum = 2;
  const client = new CricketClient(withClient(ctx).onCall);
  const [profile, seasons, events] = await Promise.all([
    client.uniqueTournament(tournamentId, { screen: "Tournament pages", component: "overview" }),
    client.uniqueTournamentSeasons(tournamentId, 1, 20, { screen: "Tournament pages", component: "seasons" }),
    client.uniqueTournamentEvents(tournamentId, 1, 10, { screen: "Tournament pages", component: "current matches" }),
  ]);
  ctx.parallel += 3;
  const tournament = normalizeTournament(unwrapTournament(profile.body) || profile.body);
  const seasonList = unwrapList(seasons.body).map(normalizeSeason).filter(Boolean);
  store.addRelationship({
    from: `tournament:${tournamentId}`,
    to: `season:${seasonList[0]?.id}`,
    idExists: seasonList.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: true,
    notes: `${seasonList.length} seasons`,
  });
  return {
    tournament,
    seasons: seasonList,
    currentSeasonId: tournament?.currentSeasonId ?? seasonList[0]?.id ?? null,
    matches: normalizeMatches(events.body, ctx, "list"),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentMatches(tournamentId: number, date?: string) {
  const ctx = new RequestContext("Tournament pages", "matches");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = date
    ? await client.uniqueTournamentScheduled(tournamentId, date, { screen: "Tournament pages", component: "scheduled" })
    : await client.uniqueTournamentEvents(tournamentId, 1, 40, { screen: "Tournament pages", component: "matches" });
  const matches = normalizeMatches(result.body, ctx, "list");
  const byDay = new Map<string, typeof matches>();
  for (const match of matches) {
    const day = match.startTime ? match.startTime.slice(0, 10) : "Unknown date";
    const list = byDay.get(day) || [];
    list.push(match);
    byDay.set(day, list);
  }
  return {
    days: [...byDay.entries()].map(([dateKey, items]) => ({ date: dateKey, matches: items })),
    dateFilter: date || null,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentSeasons(tournamentId: number) {
  const ctx = new RequestContext("Tournament pages", "seasons");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.uniqueTournamentSeasons(tournamentId, 1, 30, {
    screen: "Tournament pages",
    component: "seasons",
  });
  return {
    tournamentId,
    seasons: unwrapList(result.body).map(normalizeSeason).filter(Boolean),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentStandings(tournamentId: number, seasonId: number, type: "total" | "home" | "away" = "total") {
  const ctx = new RequestContext("Tournament pages", "standings");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.uniqueTournamentStandings(tournamentId, seasonId, type, {
    screen: "Tournament pages",
    component: "standings",
  });
  const rows = normalizeStandings(result.body);
  store.addRelationship({
    from: `season:${seasonId}`,
    to: "standings",
    idExists: rows.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: rows.every((row) => row.team.id != null),
    notes: `${type} ${rows.length} rows`,
  });
  const columns = ["position", "team", "played", "won", "lost", "nrr", "points"].filter((col) =>
    rows.some((row) => {
      if (col === "team") return row.team.name;
      return (row as unknown as Record<string, unknown>)[col] != null;
    }),
  );
  return { tournamentId, seasonId, type, columns, rows, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTournamentLeaders(tournamentId: number, seasonId?: number) {
  const ctx = new RequestContext("Tournament pages", "leaders");
  ctx.recordGap({
    code: "TOURNAMENT_LEADERS_UNAVAILABLE",
    type: "DOCUMENTATION_GAP",
    severity: "P2",
    endpoint: "/unique-tournament/{id}/season/{sid}/leaders",
    expected: "most runs / wickets / sixes / strike rate / bowling",
    actual: "no dedicated Cricket endpoint in the 39-route set",
    userImpact: "Tournament leaders cannot be shown.",
    developerImpact: "Would require assembling every player season-stat call, which is unreasonable.",
    recommendation: "Add /unique-tournament/{tournamentId}/season/{seasonId}/leaders",
    evidence: { tournamentId, seasonId },
  });
  return {
    available: false,
    message: "Tournament Leaders are not currently available through a dedicated Cricket endpoint.",
    candidate: `/unique-tournament/${tournamentId}/season/${seasonId || "{seasonId}"}/leaders`,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
