import { CricketClient } from "../raw/client.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { normalizeMatches } from "../normalize/entities.js";

export async function loadMatches(tab?: string) {
  const ctx = new RequestContext("Matches", tab || "list");
  ctx.minimum = 1;
  const client = new CricketClient(withClient(ctx).onCall);

  const status =
    tab === "live" ? "inprogress" : tab === "results" ? "finished" : undefined;

  ctx.sequential += 1;
  const [events, fixtures] = await Promise.all([
    client.events({ status, limit: 30 }, { screen: "Matches", component: tab || "list" }),
    tab === "today" || !tab
      ? client.fixturesToday(undefined, undefined, { screen: "Matches", component: "today" })
      : Promise.resolve(null),
  ]);
  ctx.parallel += fixtures ? 2 : 1;

  const list = normalizeMatches(events.body, ctx, "list");
  const today = fixtures ? normalizeMatches(fixtures.body, ctx, "list") : [];

  if ((tab === "results" || tab === "finished") && list.length === 0) {
    ctx.recordGap({
      code: "EVENT_FINISHED_FILTER_INCOMPLETE",
      type: "FILTER_INCOMPLETE",
      severity: "P2",
      endpoint: "/events?status=finished",
      expected: "completed matches when they exist elsewhere",
      actual: `total=${(events.body?.total as number | undefined) ?? list.length}`,
      userImpact: "Results tab can appear empty while finished matches exist on team featured-event.",
      developerImpact: "Cannot trust the finished filter for a Results page.",
      recommendation: "Include recent completed events in /events?status=finished.",
    });
  }

  return {
    live: tab === "live" ? list : list.filter((match) => match.status.label === "Live"),
    today: today.length ? today : list,
    upcoming: list.filter((match) => match.status.label === "Upcoming"),
    results: tab === "results" ? list : list.filter((match) => match.status.label === "Completed"),
    rawTotal: events.body?.total ?? null,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
