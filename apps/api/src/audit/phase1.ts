import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CricketClient } from "../raw/client.js";
import { config } from "../config.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { asRecord, unwrapList } from "../raw/unwrap.js";
import { TEAM_ENRICHMENT_TYPES } from "../raw/types.js";

const POOL = {
  kohli: 55089365,
  rohit: 98189805,
  india: 26236865,
  australia: 73448951,
  ipl: 77922875,
  ipl2026: 81844788,
};

async function main() {
  const ctx = new RequestContext("Phase1 audit", "untested routes");
  const client = new CricketClient(withClient(ctx).onCall);

  const auth = {
    apimOnly: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: true, live: false }),
    liveOnly: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: false, live: true }),
    both: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: true, live: true }),
  };
  if (auth.apimOnly.status === 403 && (auth.liveOnly.status === 200 || auth.both.status === 200)) {
    ctx.recordGap({
      code: "AUTHENTICATION_GAP",
      type: "AUTHENTICATION_GAP",
      severity: "P0",
      endpoint: "/fixtures/today",
      expected: "documented auth contract (both keys, or one published key)",
      actual: `APIM-only=${auth.apimOnly.status} live-only=${auth.liveOnly.status} both=${auth.both.status}`,
      userImpact: "Integration cannot start from the written docs.",
      developerImpact: "Clients guess which header is required.",
      recommendation: "Publish one Cricket auth contract.",
    });
  }

  const fixtures = await client.fixturesToday(undefined, undefined, { screen: "Phase1 audit", component: "live ids" });
  const liveId = Number(asRecord(unwrapList(fixtures.body)[0])?.id) || 29824257;

  const results = {
    players: await client.players(1, 5, { screen: "Phase1 audit", component: "/players" }),
    teams: await client.teams(1, 5, { screen: "Phase1 audit", component: "/teams" }),
    tournaments: await client.tournaments(1, 5, { screen: "Phase1 audit", component: "/tournaments" }),
    manager: await client.manager(2, { screen: "Phase1 audit", component: "/manager/2" }),
    eventEnrichments: await client.eventEnrichments(liveId, { screen: "Phase1 audit", component: "event enrichments" }),
    teamEnrichments: await client.teamEnrichments(POOL.india, { screen: "Phase1 audit", component: "team enrichments" }),
    teamMedia: await client.teamMedia(POOL.india, 1, 5, { screen: "Phase1 audit", component: "media" }),
    teamRankings: await client.teamRankings(POOL.india, 1, 5, { screen: "Phase1 audit", component: "rankings" }),
    teamTournaments: await client.teamUniqueTournaments(POOL.india, 1, 5, { screen: "Phase1 audit", component: "unique-tournaments" }),
    standingsAway: await client.uniqueTournamentStandings(POOL.ipl, POOL.ipl2026, "away", {
      screen: "Phase1 audit",
      component: "standings/away",
    }),
  };

  const enrichmentTypes = unwrapList(results.eventEnrichments.body).map((item) =>
    typeof item === "string" ? item : String(asRecord(item)?.type || ""),
  ).filter(Boolean);
  const typed =
    enrichmentTypes[0]
      ? await client.eventEnrichmentType(liveId, enrichmentTypes[0], {
          screen: "Phase1 audit",
          component: "event enrichments/type",
        })
      : await client.eventEnrichmentType(liveId, "best_players", {
          screen: "Phase1 audit",
          component: "event enrichments/type",
        });

  const teamTyped = await client.teamEnrichmentType(POOL.india, TEAM_ENRICHMENT_TYPES[0], {
    screen: "Phase1 audit",
    component: "team enrichments/type",
  });

  const summary = Object.fromEntries(
    Object.entries({ ...results, eventEnrichmentType: typed, teamEnrichmentType: teamTyped }).map(([key, value]) => [
      key,
      { status: value.status, ms: value.ms, keys: value.body ? Object.keys(value.body) : [], error: value.error || null },
    ]),
  );

  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(join(config.dataDir, "phase1-audit.json"), JSON.stringify({ liveId, auth: {
    apimOnly: auth.apimOnly.status,
    liveOnly: auth.liveOnly.status,
    both: auth.both.status,
  }, summary, gaps: ctx.gaps }, null, 2));
  store.persist();
  console.log(JSON.stringify({ liveId, summary, gapCount: ctx.gaps.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
