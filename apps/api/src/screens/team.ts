import { CricketClient } from "../raw/client.js";
import { asArray, asRecord, unwrapEvent, unwrapList, unwrapTeam } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { normalizeMatch, normalizeMatches, normalizePlayer, normalizeTournament } from "../normalize/entities.js";

function roleGroup(role: string | null): "batters" | "wicketkeepers" | "allRounders" | "bowlers" | "unknown" {
  const value = (role || "").toLowerCase();
  if (value.includes("keep")) return "wicketkeepers";
  if (value.includes("all")) return "allRounders";
  if (value.includes("bowl")) return "bowlers";
  if (value.includes("bat")) return "batters";
  return "unknown";
}

export async function loadTeam(teamId: number) {
  const ctx = new RequestContext("Team pages", "overview");
  ctx.minimum = 3;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [profile, near, performance, featured] = await Promise.all([
    client.team(teamId, { screen: "Team pages", component: "overview" }),
    client.teamNearEvents(teamId, { screen: "Team pages", component: "near-events" }),
    client.teamPerformance(teamId, { screen: "Team pages", component: "performance" }),
    client.teamFeaturedEvent(teamId, { screen: "Team pages", component: "featured-event" }),
  ]);
  ctx.parallel += 4;

  const team = asRecord(unwrapTeam(profile.body) || profile.body);
  if (!team) {
    return { error: profile.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }

  const featuredEvent = unwrapEvent(featured.body);
  ctx.recordGap({
    code: "FEATURED_EVENT_SEMANTICS_UNCLEAR",
    type: "DOCUMENTATION_GAP",
    severity: "P2",
    endpoint: `/team/${teamId}/featured-event`,
    expected: "editorial/recommended event, not current live match",
    actual: featuredEvent ? `event ${featuredEvent.id} status=${JSON.stringify(featuredEvent.status)}` : "event=null",
    userImpact: "Featured match may be finished or empty while the team is playing live elsewhere.",
    developerImpact: "Do not use featured-event as the live match resolver.",
    recommendation: "Use near-events, events/last, events/next, or global live events.",
  });

  const previous = normalizeMatch(asRecord(near.body?.previousEvent), ctx, "event");
  const next = normalizeMatch(asRecord(near.body?.nextEvent), ctx, "event");
  store.addRelationship({
    from: `team:${teamId}`,
    to: "events",
    idExists: Boolean(previous || next),
    idResolves: true,
    nameMatches: null,
    agreed: true,
    notes: "near-events used for current match, not featured-event",
  });

  return {
    team: {
      id: teamId,
      name: team.name,
      country: asRecord(team.country)?.name || team.country || null,
      logo: team.logo || team.image || null,
      managerId: asRecord(team.manager)?.id || team.managerId || null,
    },
    previousMatch: previous,
    nextMatch: next,
    featuredEvent: featuredEvent ? normalizeMatch(featuredEvent, ctx, "event") : null,
    featuredIsEditorial: true,
    performance: performance.body,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamMatches(teamId: number) {
  const ctx = new RequestContext("Team pages", "matches");
  ctx.minimum = 2;
  const client = new CricketClient(withClient(ctx).onCall);
  const [last, next, near] = await Promise.all([
    client.teamEvents(teamId, "last", 1, 15, { screen: "Team pages", component: "results" }),
    client.teamEvents(teamId, "next", 1, 15, { screen: "Team pages", component: "fixtures" }),
    client.teamNearEvents(teamId, { screen: "Team pages", component: "near-events" }),
  ]);
  ctx.parallel += 3;
  return {
    results: normalizeMatches(last.body, ctx, "list"),
    fixtures: normalizeMatches(next.body, ctx, "list"),
    near: {
      previous: normalizeMatch(asRecord(near.body?.previousEvent), ctx, "event"),
      next: normalizeMatch(asRecord(near.body?.nextEvent), ctx, "event"),
    },
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamSquad(teamId: number) {
  const ctx = new RequestContext("Team pages", "squad");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teamPlayers(teamId, { screen: "Team pages", component: "squad" });
  const players = unwrapList(result.body).map(normalizePlayer).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const grouped = {
    batters: players.filter((player) => roleGroup(player.role) === "batters"),
    wicketkeepers: players.filter((player) => roleGroup(player.role) === "wicketkeepers"),
    allRounders: players.filter((player) => roleGroup(player.role) === "allRounders"),
    bowlers: players.filter((player) => roleGroup(player.role) === "bowlers"),
    unknown: players.filter((player) => roleGroup(player.role) === "unknown"),
  };
  if (grouped.unknown.length === players.length && players.length) {
    ctx.recordGap({
      code: "TEAM_PLAYER_ROLE_MISSING",
      type: "MISSING_FIELD",
      severity: "P2",
      endpoint: `/team/${teamId}/players`,
      field: "role",
      expected: "role sufficient to group batters / keepers / all-rounders / bowlers",
      actual: "role missing or unusable",
      userImpact: "Squad cannot be grouped the way a cricket product expects.",
      developerImpact: "Must show a flat list or infer role from other fields.",
    });
  }
  store.addRelationship({
    from: `team:${teamId}`,
    to: "players",
    idExists: players.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: true,
    notes: `${players.length} squad players`,
  });
  return { players, grouped, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTeamPerformance(teamId: number) {
  const ctx = new RequestContext("Team pages", "performance");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teamPerformance(teamId, { screen: "Team pages", component: "performance" });
  const body = result.body || {};
  return {
    events: asArray(body.events),
    points: body.points ?? null,
    raw: body,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamRankings(teamId: number) {
  const ctx = new RequestContext("Team pages", "rankings");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teamRankings(teamId, 1, 20, { screen: "Team pages", component: "rankings" });
  return {
    items: unwrapList(result.body),
    total: result.body?.total ?? 0,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamCompetitions(teamId: number) {
  const ctx = new RequestContext("Team pages", "competitions");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teamUniqueTournaments(teamId, 1, 30, { screen: "Team pages", component: "competitions" });
  return {
    items: unwrapList(result.body).map(normalizeTournament).filter(Boolean),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamMedia(teamId: number) {
  const ctx = new RequestContext("Team pages", "media");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teamMedia(teamId, 1, 20, { screen: "Team pages", component: "media" });
  return { items: unwrapList(result.body), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTeamsDirectory(page = 1) {
  const ctx = new RequestContext("Teams directory", "list");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.teams(page, 20, { screen: "Teams directory", component: "list" });
  return {
    items: unwrapList(result.body),
    page,
    total: result.body?.total ?? 0,
    hasMore: Boolean(result.body?.hasMore),
    audit: "AUDIT REQUIRED",
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadManager(managerId: number) {
  const ctx = new RequestContext("Team staff", "manager");
  const client = new CricketClient(withClient(ctx).onCall);
  const result = await client.manager(managerId, { screen: "Team staff", component: "manager" });
  return { manager: result.body, status: result.status, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}
