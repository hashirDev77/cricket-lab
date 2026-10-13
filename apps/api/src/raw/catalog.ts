export interface CatalogRoute {
  path: string;
  screen: string;
  status: "tested" | "needs_testing";
  notes?: string;
}

export const CATALOG: CatalogRoute[] = [
  { path: "/search", screen: "Search", status: "tested" },
  { path: "/fixtures/today", screen: "Home", status: "tested", notes: "Live scores missing on list" },
  { path: "/events", screen: "Matches", status: "tested" },
  { path: "/event/{id}", screen: "Match", status: "tested" },
  { path: "/event/{id}/ball-by-ball", screen: "Commentary", status: "tested" },
  { path: "/event/{id}/best-players", screen: "Insights", status: "tested", notes: "optional 404" },
  { path: "/event/{id}/enrichments", screen: "Insights", status: "tested", notes: "empty types" },
  { path: "/event/{id}/enrichments/{type}", screen: "Insights", status: "tested", notes: "optional 404" },
  { path: "/event/{id}/h2h", screen: "Match", status: "tested" },
  { path: "/event/{id}/innings", screen: "Scorecard", status: "tested" },
  { path: "/event/{id}/odds", screen: "Odds", status: "tested" },
  { path: "/event/{id}/overs", screen: "Overs", status: "tested" },
  { path: "/event/{id}/period-scores", screen: "Match", status: "tested" },
  { path: "/event/{id}/pregame-form", screen: "Match", status: "tested" },
  { path: "/event/{id}/team-streaks", screen: "Insights", status: "tested", notes: "optional 404" },
  { path: "/manager/{id}", screen: "Team staff", status: "tested", notes: "404 unless team payload has a manager id" },
  { path: "/player/{id}", screen: "Player", status: "tested" },
  { path: "/player/{id}/events/{direction}", screen: "Player", status: "tested" },
  { path: "/player/{id}/unique-tournament/{tid}/season/{sid}/statistics", screen: "Player stats", status: "tested" },
  { path: "/players", screen: "Players directory", status: "tested" },
  { path: "/team/{id}", screen: "Team", status: "tested" },
  { path: "/team/{id}/enrichments", screen: "Team insights", status: "tested" },
  { path: "/team/{id}/enrichments/{type}", screen: "Team insights", status: "tested" },
  { path: "/team/{id}/events/{direction}", screen: "Team matches", status: "tested" },
  { path: "/team/{id}/featured-event", screen: "Team", status: "tested", notes: "unreliable semantics" },
  { path: "/team/{id}/media", screen: "Team media", status: "tested" },
  { path: "/team/{id}/near-events", screen: "Team", status: "tested" },
  { path: "/team/{id}/performance", screen: "Team", status: "tested" },
  { path: "/team/{id}/players", screen: "Squad", status: "tested" },
  { path: "/team/{id}/rankings", screen: "Rankings", status: "tested" },
  { path: "/team/{id}/standings-seasons", screen: "Team", status: "tested" },
  { path: "/team/{id}/unique-tournaments", screen: "Team", status: "tested" },
  { path: "/teams", screen: "Teams directory", status: "tested" },
  { path: "/tournaments", screen: "Competitions", status: "tested" },
  { path: "/unique-tournament/{id}", screen: "Tournament", status: "tested" },
  { path: "/unique-tournament/{id}/events", screen: "Tournament", status: "tested" },
  { path: "/unique-tournament/{id}/scheduled-events/{date}", screen: "Tournament", status: "tested" },
  { path: "/unique-tournament/{id}/season/{sid}/standings/{type}", screen: "Standings", status: "tested" },
  { path: "/unique-tournament/{id}/seasons", screen: "Tournament", status: "tested" },
];
