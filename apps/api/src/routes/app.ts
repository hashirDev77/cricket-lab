import type { FastifyInstance } from "fastify";
import { loadHome } from "../screens/home.js";
import { loadMatches } from "../screens/matches.js";
import {
  loadCommentary,
  loadInsights,
  loadMatchOverview,
  loadOdds,
  loadOvers,
  loadScorecard,
} from "../screens/match.js";
import { loadSearch } from "../screens/search.js";
import {
  loadPlayer,
  loadPlayerMatches,
  loadPlayerStatistics,
  loadPlayersDirectory,
} from "../screens/player.js";
import {
  loadManager,
  loadTeam,
  loadTeamCompetitions,
  loadTeamMatches,
  loadTeamMedia,
  loadTeamPerformance,
  loadTeamRankings,
  loadTeamSquad,
  loadTeamsDirectory,
} from "../screens/team.js";
import {
  loadTournament,
  loadTournamentLeaders,
  loadTournamentMatches,
  loadTournamentSeasons,
  loadTournamentStandings,
  loadTournaments,
} from "../screens/tournament.js";

function idParam(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function registerAppRoutes(app: FastifyInstance) {
  app.get("/app/cricket/home", async () => loadHome());
  app.get("/app/cricket/matches", async (req) => {
    const tab = (req.query as { tab?: string }).tab;
    return loadMatches(tab);
  });
  app.get("/app/cricket/matches/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadMatchOverview(id);
  });
  app.get("/app/cricket/matches/:id/scorecard", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadScorecard(id);
  });
  app.get("/app/cricket/matches/:id/commentary", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    const cursor = (req.query as { cursor?: string }).cursor;
    return loadCommentary(id, cursor);
  });
  app.get("/app/cricket/matches/:id/overs", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadOvers(id);
  });
  app.get("/app/cricket/matches/:id/insights", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadInsights(id);
  });
  app.get("/app/cricket/matches/:id/odds", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadOdds(id);
  });
  app.get("/app/cricket/search", async (req, reply) => {
    const q = String((req.query as { q?: string }).q || "").trim();
    if (q.length < 2) return reply.code(400).send({ error: "Query must be at least 2 characters" });
    return loadSearch(q);
  });
  app.get("/app/cricket/players", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadPlayersDirectory(page);
  });
  app.get("/app/cricket/players/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    return loadPlayer(id);
  });
  app.get("/app/cricket/players/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    return loadPlayerMatches(id);
  });
  app.get("/app/cricket/players/:id/statistics", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    const q = req.query as { tournamentId?: string; seasonId?: string };
    return loadPlayerStatistics(id, q.tournamentId ? Number(q.tournamentId) : undefined, q.seasonId ? Number(q.seasonId) : undefined);
  });
  app.get("/app/cricket/teams", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadTeamsDirectory(page);
  });
  app.get("/app/cricket/teams/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeam(id);
  });
  app.get("/app/cricket/teams/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamMatches(id);
  });
  app.get("/app/cricket/teams/:id/squad", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamSquad(id);
  });
  app.get("/app/cricket/teams/:id/performance", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamPerformance(id);
  });
  app.get("/app/cricket/teams/:id/rankings", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamRankings(id);
  });
  app.get("/app/cricket/teams/:id/competitions", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamCompetitions(id);
  });
  app.get("/app/cricket/teams/:id/media", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamMedia(id);
  });
  app.get("/app/cricket/tournaments", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadTournaments(page);
  });
  app.get("/app/cricket/tournaments/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid tournament id" });
    return loadTournament(id);
  });
  app.get("/app/cricket/tournaments/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid tournament id" });
    const date = (req.query as { date?: string }).date;
    return loadTournamentMatches(id, date);
  });
  app.get("/app/cricket/tournaments/:id/standings", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid tournament id" });
    const q = req.query as { seasonId?: string; type?: "total" | "home" | "away" };
    if (!q.seasonId) return reply.code(400).send({ error: "seasonId is required" });
    return loadTournamentStandings(id, Number(q.seasonId), q.type || "total");
  });
  app.get("/app/cricket/tournaments/:id/seasons", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid tournament id" });
    return loadTournamentSeasons(id);
  });
  app.get("/app/cricket/tournaments/:id/leaders", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid tournament id" });
    const seasonId = (req.query as { seasonId?: string }).seasonId;
    return loadTournamentLeaders(id, seasonId ? Number(seasonId) : undefined);
  });
  app.get("/app/cricket/managers/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid manager id" });
    return loadManager(id);
  });
}
