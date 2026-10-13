import { CricketClient } from "../raw/client.js";
import { asRecord, unwrapList, unwrapPlayer } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { evaluatePlayerContract } from "../contracts/index.js";
import { normalizeMatch, normalizeMatches, normalizePlayer } from "../normalize/entities.js";
import { store } from "../gaps/store.js";

const IPL = 77922875;
const IPL_2026 = 81844788;

export async function loadPlayer(playerId: number) {
  const ctx = new RequestContext("Player", "overview");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.player(playerId, { screen: "Player", component: "overview" });
  const player = normalizePlayer(unwrapPlayer(result.body) || result.body);
  if (!player) {
    return { error: result.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }
  evaluatePlayerContract(ctx, player);
  store.addRelationship({
    from: `player:${player.id}`,
    to: `team:${player.team?.id}`,
    idExists: player.team?.id != null,
    idResolves: null,
    nameMatches: Boolean(player.team?.name),
    agreed: player.team?.id != null,
    notes: "player → team",
  });
  return { player, rawMissing: collectMissingProfile(player), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

function collectMissingProfile(player: ReturnType<typeof normalizePlayer>) {
  if (!player) return [];
  return (["team", "country", "role", "battingStyle", "bowlingStyle", "image"] as const).filter((key) => {
    const value = player[key];
    return value == null || (typeof value === "object" && value && "id" in value && value.id == null && !value.name);
  });
}

export async function loadPlayerMatches(playerId: number) {
  const ctx = new RequestContext("Player", "matches");
  ctx.minimum = 2;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [last, next] = await Promise.all([
    client.playerEvents(playerId, "last", 1, 10, { screen: "Player", component: "Recent matches" }),
    client.playerEvents(playerId, "next", 1, 10, { screen: "Player", component: "Upcoming matches" }),
  ]);
  ctx.parallel += 2;
  const recent = normalizeMatches(last.body, ctx, "list");
  const upcoming = normalizeMatches(next.body, ctx, "list");
  const hasPerformance = recent.some((match) => match.score.home.runs != null || match.result);
  if (!hasPerformance && recent.length) {
    ctx.recordGap({
      code: "PLAYER_EVENT_PERFORMANCE_MISSING",
      type: "MISSING_FIELD",
      severity: "P2",
      endpoint: `/player/${playerId}/events/last`,
      expected: "player performance on recent match cards",
      actual: "teams/status only",
      userImpact: "Recent matches do not show the player's own figures.",
      developerImpact: "Event lists are not a player scorecard.",
    });
  }
  store.addRelationship({
    from: `player:${playerId}`,
    to: "events",
    idExists: recent.length + upcoming.length > 0,
    idResolves: true,
    nameMatches: null,
    agreed: true,
    notes: `last total=${last.body?.total ?? recent.length}`,
  });
  return {
    recent,
    upcoming,
    totals: { last: last.body?.total ?? recent.length, next: next.body?.total ?? upcoming.length },
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadPlayerStatistics(playerId: number, tournamentId = IPL, seasonId = IPL_2026) {
  const ctx = new RequestContext("Player statistics", "season");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.playerSeasonStatistics(playerId, tournamentId, seasonId, {
    screen: "Player statistics",
    component: "season",
  });
  if (result.status === 404) {
    ctx.recordGap({
      code: "PLAYER_SEASON_STATS_COVERAGE",
      type: "OPTIONAL_404",
      severity: "P1",
      endpoint: `/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics`,
      expected: "season statistics for squad members",
      actual: result.error || "404",
      userImpact: "No statistics available for this season.",
      developerImpact: "Same season can 200 for one player and 404 for another.",
      recommendation: "Publish coverage or a player-level statistics index.",
    });
    return {
      available: false,
      tournamentId,
      seasonId,
      batting: null,
      bowling: null,
      fielding: null,
      raw: null,
      _meta: { calls: ctx.meta(), gaps: ctx.gaps },
    };
  }
  const stats = asRecord(result.body?.statistics) || asRecord(result.body) || {};
  return {
    available: true,
    tournamentId,
    seasonId,
    player: normalizePlayer(unwrapPlayer(result.body) || result.body),
    batting: pick(stats, ["matches", "innings", "runs", "average", "strikeRate", "hundreds", "fifties", "fours", "sixes", "highestScore"]),
    bowling: pick(stats, ["overs", "runs", "wickets", "average", "economy", "strikeRate", "bestFigures"]),
    fielding: pick(stats, ["catches", "stumpings", "runOuts"]),
    raw: stats,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadPlayersDirectory(page = 1) {
  const ctx = new RequestContext("Players directory", "list");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.players(page, 20, { screen: "Players directory", component: "list" });
  const items = unwrapList(result.body)
    .map((row) => normalizePlayer(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (result.status === 200) {
    ctx.recordGap({
      code: "PLAYERS_DIRECTORY_AUDITED",
      type: "DOCUMENTATION_GAP",
      severity: "P3",
      endpoint: "/players",
      expected: "pagination, country, team, role, images",
      actual: `page=${page} total=${result.body?.total ?? items.length} keys=${Object.keys(result.body || {}).join(",")}`,
      userImpact: "Directory exists but filter support is unclear.",
      developerImpact: "Inspect payload before promising filters.",
    });
  }
  return {
    items,
    page,
    total: result.body?.total ?? items.length,
    hasMore: Boolean(result.body?.hasMore),
    audit: "AUDIT REQUIRED",
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

function pick(obj: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (obj[key] != null) out[key] = obj[key];
  }
  return Object.keys(out).length ? out : null;
}

export { normalizeMatch };
