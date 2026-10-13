import { store } from "./store.js";

export function recommendationsFromGaps() {
  const recs: Array<{ title: string; body: string; basedOn: string[] }> = [];
  const codes = new Set(store.gaps.map((gap) => gap.code));

  if (codes.has("HOME_MATCH_SCORE_MISSING")) {
    recs.push({
      title: "Improve /fixtures/today",
      body: "Add score, current innings, and overs on list rows so a live home card does not require N+1 event-detail calls.",
      basedOn: ["HOME_MATCH_SCORE_MISSING"],
    });
  }
  if (codes.has("SCHEMA_INCONSISTENCY") || store.schemaNotes.length) {
    recs.push({
      title: "Normalize /events and /event/{id}",
      body: "Use one status object and one timestamp type across list and detail payloads.",
      basedOn: ["SCHEMA_INCONSISTENCY"],
    });
  }
  if (codes.has("BROKEN_RELATIONSHIP")) {
    recs.push({
      title: "Always emit uniqueTournament.id on event detail",
      body: "Match → tournament navigation fails when the list has tournamentId but detail sets uniqueTournament.id to null.",
      basedOn: ["BROKEN_RELATIONSHIP"],
    });
  }
  if (codes.has("OPTIONAL_404")) {
    recs.push({
      title: "Return empty 200 for optional extras",
      body: "best-players, team-streaks, and enrichment types should not 404 on a valid live match.",
      basedOn: ["OPTIONAL_404"],
    });
  }
  if (codes.has("PLAYER_SEASON_STATS_COVERAGE")) {
    recs.push({
      title: "Document player season-stat coverage",
      body: "The same tournament/season can return 200 for one squad member and 404 for another. Publish coverage or a dedicated /player/{id}/statistics route.",
      basedOn: ["PLAYER_SEASON_STATS_COVERAGE"],
    });
  }
  if (codes.has("EVENT_FINISHED_FILTER_INCOMPLETE")) {
    recs.push({
      title: "Fix /events?status=finished",
      body: "Completed matches exist on other endpoints while the finished filter returns total=0.",
      basedOn: ["EVENT_FINISHED_FILTER_INCOMPLETE"],
    });
  }
  if (codes.has("TOURNAMENT_LEADERS_UNAVAILABLE")) {
    recs.push({
      title: "Consider /unique-tournament/{id}/season/{sid}/leaders",
      body: "Most runs, wickets, sixes, and bowling figures cannot be built from a dedicated Cricket endpoint today.",
      basedOn: ["TOURNAMENT_LEADERS_UNAVAILABLE"],
    });
  }
  if (codes.has("SCORECARD_ASSEMBLY")) {
    recs.push({
      title: "Consider /event/{id}/scorecard",
      body: "A usable scorecard currently requires assembling innings, period-scores, overs, and sometimes ball-by-ball.",
      basedOn: ["SCORECARD_ASSEMBLY"],
    });
  }
  if (codes.has("FEATURED_EVENT_SEMANTICS_UNCLEAR")) {
    recs.push({
      title: "Document featured-event as editorial",
      body: "Do not treat featured-event as the current live match. Point live UX at near-events or global live events.",
      basedOn: ["FEATURED_EVENT_SEMANTICS_UNCLEAR"],
    });
  }
  if (codes.has("AUTHENTICATION_GAP")) {
    recs.push({
      title: "Publish one auth contract",
      body: "APIM-only can 403 while live-key-only succeeds. Document the required headers for Cricket.",
      basedOn: ["AUTHENTICATION_GAP"],
    });
  }
  return recs;
}
