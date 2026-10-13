import { CricketClient } from "../raw/client.js";
import { unwrapEvent } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { HOME_CARD, evaluateContract, isLive } from "../contracts/index.js";
import { hasScore, normalizeMatch, normalizeMatches } from "../normalize/entities.js";
import type { CricketMatch } from "../normalize/models.js";

function bucket(matches: CricketMatch[]) {
  const live: CricketMatch[] = [];
  const today: CricketMatch[] = [];
  const upcoming: CricketMatch[] = [];
  const completed: CricketMatch[] = [];
  for (const match of matches) {
    const code = match.status.code.toLowerCase();
    if (isLive(match)) live.push(match);
    else if (code.includes("finish") || code.includes("complete")) completed.push(match);
    else upcoming.push(match);
    today.push(match);
  }
  return { live, today, upcoming, completed };
}

export async function loadHome() {
  const ctx = new RequestContext("Home", "Live match card");
  ctx.minimum = 2;
  const client = new CricketClient(withClient(ctx).onCall);

  ctx.sequential += 1;
  const [fixtures, liveFeed] = await Promise.all([
    client.fixturesToday(undefined, undefined, { screen: "Home", component: "Today list" }),
    client.events({ status: "inprogress", limit: 20 }, { screen: "Home", component: "Live feed" }),
  ]);
  ctx.parallel += 2;

  const fromFixtures = normalizeMatches(fixtures.body, ctx, "list");
  const fromLive = normalizeMatches(liveFeed.body, ctx, "list");
  const byId = new Map<number, CricketMatch>();
  for (const match of [...fromFixtures, ...fromLive]) byId.set(match.id, match);

  const needEnrichment = [...byId.values()].filter((match) => isLive(match) && !hasScore(match.score.home) && !hasScore(match.score.away));
  if (needEnrichment.length) {
    ctx.recordGap({
      code: "HOME_MATCH_SCORE_MISSING",
      type: "EXTRA_REQUEST_REQUIRED",
      severity: "P1",
      endpoint: "/fixtures/today",
      expected: "score available for live match cards",
      actual: "fixture returned no score",
      fallback: "/event/{eventId}",
      extraCalls: needEnrichment.length,
      userImpact: "Live cards cannot display the current match score from the list response.",
      developerImpact: "N+1 event-detail requests.",
      recommendation: "Include a compact score object in fixture list response.",
    });
  }

  ctx.sequential += 1;
  const details = await Promise.all(
    needEnrichment.map((match) =>
      client.event(match.id, {
        screen: "Home",
        component: "Live match card",
        fallback: true,
        fallbackEndpoint: `/event/${match.id}`,
      }),
    ),
  );
  ctx.parallel += details.length;

  for (const detail of details) {
    const normalized = normalizeMatch(unwrapEvent(detail.body) || detail.body, ctx, "event");
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    if (existing && existing.tournament.id && !normalized.tournament.id) {
      normalized.tournament.id = existing.tournament.id;
      ctx.recordGap({
        code: "BROKEN_RELATIONSHIP",
        type: "BROKEN_RELATIONSHIP",
        severity: "P1",
        endpoint: "/event/{id}",
        field: "uniqueTournament.id",
        expected: "tournament id from list",
        actual: "null on detail",
        fallback: "fixture tournamentId",
        userImpact: "Cannot reliably navigate match → tournament.",
        developerImpact: "Must cache list tournamentId to keep the relationship.",
      });
    }
    if (normalized) byId.set(normalized.id, { ...existing, ...normalized, tournament: {
      id: normalized.tournament.id ?? existing?.tournament.id ?? null,
      name: normalized.tournament.name ?? existing?.tournament.name ?? null,
    }});
  }

  for (const match of byId.values()) {
    evaluateContract(ctx, "/fixtures/today", "Live match card", {
      id: match.id,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      status: match.status.code,
      startTime: match.startTime,
      score: hasScore(match.score.home) || hasScore(match.score.away) ? match.score : null,
      innings: match.currentInnings?.label,
      overs: match.currentInnings?.overs,
      tournament: match.tournament.name,
      venue: match.venue,
    }, HOME_CARD, isLive(match));
  }

  const grouped = bucket([...byId.values()]);
  return { ...grouped, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}
