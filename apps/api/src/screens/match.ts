import { CricketClient } from "../raw/client.js";
import { asArray, asRecord, isOptionalEnrichment404, unwrapEvent, unwrapList } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import {
  classify,
  normalizeBall,
  normalizeInnings,
  normalizeMatch,
  normalizeOdds,
  normalizeOvers,
} from "../normalize/entities.js";
import type { WidgetStatus } from "../gaps/types.js";

function widget(status: WidgetStatus, data: unknown, note?: string) {
  return { status, data, note };
}

export async function loadMatchOverview(eventId: number) {
  const ctx = new RequestContext("Match overview", "header");
  ctx.minimum = 3;
  const client = new CricketClient(withClient(ctx).onCall);

  ctx.sequential += 1;
  const [eventRes, periods, form, h2h, streaks, best] = await Promise.all([
    client.event(eventId, { screen: "Match overview", component: "header" }),
    client.eventPeriodScores(eventId, { screen: "Match overview", component: "Period scores" }),
    client.eventPregameForm(eventId, { screen: "Match overview", component: "Recent form" }),
    client.eventH2h(eventId, { screen: "Match overview", component: "Head to Head" }),
    client.eventTeamStreaks(eventId, { screen: "Match overview", component: "Team streaks" }),
    client.eventBestPlayers(eventId, { screen: "Match overview", component: "Best players" }),
  ]);
  ctx.parallel += 6;

  const match = normalizeMatch(unwrapEvent(eventRes.body) || eventRes.body, ctx, "event");
  if (!match && eventRes.status !== 200) {
    return { error: eventRes.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }

  if (match) {
    store.addRelationship({
      from: `match:${match.id}`,
      to: `tournament:${match.tournament.id}`,
      idExists: match.tournament.id != null,
      idResolves: null,
      nameMatches: Boolean(match.tournament.name),
      agreed: match.tournament.id != null,
      notes: match.tournament.id == null ? "uniqueTournament.id null on detail" : "ok",
    });
    store.addRelationship({
      from: `match:${match.id}`,
      to: `team:${match.homeTeam.id}/${match.awayTeam.id}`,
      idExists: Boolean(match.homeTeam.id && match.awayTeam.id),
      idResolves: null,
      nameMatches: Boolean(match.homeTeam.name && match.awayTeam.name),
      agreed: Boolean(match.homeTeam.id && match.awayTeam.id),
      notes: "match → teams",
    });
  }

  const streaksWidget = isOptionalEnrichment404(streaks)
    ? widget("OPTIONAL_404", null, "Team streak information is not available for this match.")
    : streaks.body && Object.keys(streaks.body).length
      ? widget("SUPPORTED", streaks.body)
      : widget("EMPTY", null, "Team streak information is not available for this match.");
  if (streaksWidget.status !== "SUPPORTED") {
    ctx.recordGap({
      code: "MATCH_TEAM_STREAKS_UNAVAILABLE",
      type: streaks.status === 404 ? "OPTIONAL_404" : "EMPTY_RESPONSE",
      severity: "P2",
      endpoint: `/event/${eventId}/team-streaks`,
      expected: "optional team streaks payload",
      actual: String(streaks.status),
      userImpact: "Team streak widget hidden.",
      developerImpact: "Must treat 404 as optional empty, not match-not-found.",
    });
  }

  const bestWidget = isOptionalEnrichment404(best)
    ? widget("OPTIONAL_404", null, "Best player information is not available for this match.")
    : best.body && Object.keys(best.body).length
      ? widget("SUPPORTED", best.body)
      : widget("EMPTY", null, "Best player information is not available for this match.");
  if (bestWidget.status !== "SUPPORTED") {
    ctx.recordGap({
      code: "MATCH_BEST_PLAYERS_UNAVAILABLE",
      type: best.status === 404 ? "OPTIONAL_404" : "EMPTY_RESPONSE",
      severity: "P2",
      endpoint: `/event/${eventId}/best-players`,
      expected: "optional best players payload",
      actual: String(best.status),
      userImpact: "Best players widget hidden.",
      developerImpact: "Must treat 404 as optional empty.",
    });
  }

  return {
    match,
    periodScores: asArray(periods.body?.periods),
    form: form.body,
    h2h: h2h.body,
    teamStreaks: streaksWidget,
    bestPlayers: bestWidget,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadScorecard(eventId: number) {
  const ctx = new RequestContext("Scorecard", "innings");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [eventRes, inningsRes, periods] = await Promise.all([
    client.event(eventId, { screen: "Scorecard", component: "header" }),
    client.eventInnings(eventId, { screen: "Scorecard", component: "innings" }),
    client.eventPeriodScores(eventId, { screen: "Scorecard", component: "period-scores" }),
  ]);
  ctx.parallel += 3;

  const match = normalizeMatch(unwrapEvent(eventRes.body) || eventRes.body, ctx, "event");
  const innings = normalizeInnings(inningsRes.body);
  if (innings.length === 0) {
    ctx.recordGap({
      code: "SCORECARD_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P1",
      endpoint: `/event/${eventId}/innings`,
      expected: "at least one innings for an in-progress or finished match",
      actual: "no innings",
      userImpact: "Scorecard cannot render batting or bowling.",
      developerImpact: "Need overs/ball-by-ball reconstruction or a dedicated scorecard endpoint.",
    });
  }
  const missingCore = innings.some((inning) => inning.fields.partnership === "MISSING" || inning.fields.dismissal === "MISSING");
  if (missingCore) {
    ctx.recordGap({
      code: "SCORECARD_ASSEMBLY",
      type: "DERIVATION_REQUIRED",
      severity: "P2",
      endpoint: `/event/${eventId}/innings`,
      expected: "dismissals, partnerships, extras, fall of wickets",
      actual: "some scorecard fields missing or derived",
      userImpact: "Scorecard is partial compared with a broadcast card.",
      developerImpact: "Building a scorecard requires assembling multiple responses.",
      recommendation: "Add /event/{id}/scorecard or include partnerships and dismissals on innings.",
    });
  }

  return {
    match,
    innings,
    periodScores: asArray(periods.body?.periods),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadCommentary(eventId: number, cursor?: string) {
  const ctx = new RequestContext("Commentary", "balls");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  const page = cursor ? Number(cursor) || 1 : 1;
  ctx.sequential += 1;
  const result = await client.eventBallByBall(eventId, page, 50, { screen: "Commentary", component: "balls" });
  const balls = unwrapList(result.body).map(normalizeBall);
  for (const ball of balls) {
    const fields = ["over", "ball", "batter", "bowler", "runs", "commentary"] as const;
    for (const field of fields) {
      if (ball[field] == null) {
        ctx.recordGap({
          code: "COMMENTARY_FIELD_MISSING",
          type: "MISSING_FIELD",
          severity: "P3",
          endpoint: `/event/${eventId}/ball-by-ball`,
          field,
          expected: field,
          actual: "null",
          userImpact: "Commentary line is incomplete.",
          developerImpact: `Ball-by-ball ${field} is not always populated.`,
        });
      }
    }
  }
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
    total: result.body?.total ?? balls.length,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadOvers(eventId: number) {
  const ctx = new RequestContext("Overs", "overs");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.eventOvers(eventId, 1, 80, { screen: "Overs", component: "overs" });
  const overs = normalizeOvers(result.body);
  for (const over of overs) {
    for (const field of ["over", "runs", "wickets"] as const) {
      if (over[field] == null) {
        ctx.recordGap({
          code: "OVER_FIELD_MISSING",
          type: "MISSING_FIELD",
          severity: "P3",
          endpoint: `/event/${eventId}/overs`,
          field,
          expected: field,
          actual: "null",
          userImpact: "Over summary is incomplete.",
          developerImpact: "Over payload does not always include core fields.",
        });
      }
    }
  }
  let runningRuns = 0;
  let runningWickets = 0;
  const progression = overs.map((over) => {
    runningRuns += over.runs || 0;
    runningWickets += over.wickets || 0;
    return { over: over.over, score: `${runningRuns}/${runningWickets}` };
  });
  return { overs, progression, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadInsights(eventId: number) {
  const ctx = new RequestContext("Insights", "widgets");
  ctx.minimum = 3;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [h2h, form, best, streaks, enrichments] = await Promise.all([
    client.eventH2h(eventId, { screen: "Insights", component: "Head to Head" }),
    client.eventPregameForm(eventId, { screen: "Insights", component: "Recent form" }),
    client.eventBestPlayers(eventId, { screen: "Insights", component: "Best performers" }),
    client.eventTeamStreaks(eventId, { screen: "Insights", component: "Team streaks" }),
    client.eventEnrichments(eventId, { screen: "Insights", component: "Other insights" }),
  ]);
  ctx.parallel += 5;

  const types = asArray(enrichments.body?.types).map((item) => {
    const rec = asRecord(item);
    return typeof item === "string" ? item : String(rec?.type || rec?.name || "");
  }).filter(Boolean);

  let typed: Array<{ type: string; status: number; body: unknown }> = [];
  if (types.length) {
    typed = await Promise.all(
      types.slice(0, 5).map(async (type) => {
        const result = await client.eventEnrichmentType(eventId, type, {
          screen: "Insights",
          component: `enrichment:${type}`,
        });
        return { type, status: result.status, body: result.body };
      }),
    );
    ctx.parallel += typed.length;
  } else {
    ctx.recordGap({
      code: "EVENT_ENRICHMENTS_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P3",
      endpoint: `/event/${eventId}/enrichments`,
      expected: "documented enrichment types",
      actual: "types = []",
      userImpact: "Insights tab has no extra widgets.",
      developerImpact: "Enrichment catalog is empty even on live matches.",
    });
  }

  const components = {
    h2h: h2h.status === 200 && h2h.body ? widget("SUPPORTED", h2h.body) : widget("NO_DATA", null),
    form: form.status === 200 && form.body ? widget("SUPPORTED", form.body) : widget("NO_DATA", null),
    bestPlayers: isOptionalEnrichment404(best) ? widget("OPTIONAL_404", null) : widget(best.status === 200 ? "SUPPORTED" : "ERROR", best.body),
    teamStreaks: isOptionalEnrichment404(streaks) ? widget("OPTIONAL_404", null) : widget(streaks.status === 200 ? "SUPPORTED" : "ERROR", streaks.body),
    enrichments: types.length ? widget("SUPPORTED", types) : widget("EMPTY", []),
    typed,
  };
  return { components, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadOdds(eventId: number) {
  const ctx = new RequestContext("Odds", "markets");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.eventOdds(eventId, { screen: "Odds", component: "markets" });
  const markets = normalizeOdds(result.body);
  return {
    markets,
    responseTime: result.ms,
    marketCount: markets.length,
    stale: result.ms >= 800,
    provider: "sportsapi365",
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export { classify };
