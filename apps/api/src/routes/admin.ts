import type { FastifyInstance } from "fastify";
import { CATALOG } from "../raw/catalog.js";
import { store } from "../gaps/store.js";
import { coverageByScreen, endpointHealth, scoreFromGaps } from "../gaps/scoring.js";
import { recommendationsFromGaps } from "../gaps/recommendations.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/cricket/gaps", async () => ({
    total: store.gaps.length,
    calls: store.calls.length,
    gaps: [...store.gaps].reverse(),
    recommendations: recommendationsFromGaps(),
  }));

  app.get("/admin/cricket/gaps/screen/:screen", async (req) => {
    const screen = decodeURIComponent((req.params as { screen: string }).screen);
    return { screen, gaps: store.byScreen(screen), scores: scoreFromGaps(screen) };
  });

  app.get("/admin/cricket/gaps/endpoint/:endpoint", async (req) => {
    const endpoint = decodeURIComponent((req.params as { endpoint: string }).endpoint);
    return { endpoint, gaps: store.byEndpoint(endpoint) };
  });

  app.get("/admin/cricket/gaps/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const gap = store.gaps.find((item) => item.id === id);
    if (!gap) return reply.code(404).send({ error: "Gap not found" });
    const relatedCalls = store.calls.filter(
      (call) => call.endpoint === gap.endpoint || call.screen === gap.screen,
    ).slice(-20);
    return { gap, relatedCalls };
  });

  app.get("/admin/cricket/coverage", async () => ({
    screens: coverageByScreen(),
    endpoints: endpointHealth(),
    catalog: CATALOG,
    totals: {
      matches: new Set(store.calls.filter((c) => c.endpoint.includes("/event/")).map((c) => c.endpoint)).size,
      teams: new Set(store.calls.filter((c) => c.endpoint.includes("/team/")).map((c) => c.endpoint)).size,
      players: new Set(store.calls.filter((c) => c.endpoint.includes("/player/")).map((c) => c.endpoint)).size,
      tournaments: new Set(store.calls.filter((c) => c.endpoint.includes("tournament")).map((c) => c.endpoint)).size,
      apiCalls: store.calls.length,
      averageMs: store.calls.length
        ? Math.round(store.calls.reduce((sum, call) => sum + call.ms, 0) / store.calls.length)
        : 0,
      missingFields: store.gaps.filter((g) => g.type === "MISSING_FIELD" || g.type === "NULL_FIELD").length,
      fallbackCalls: store.calls.filter((c) => c.fallbackUsed).length,
      optional404: store.gaps.filter((g) => g.type === "OPTIONAL_404").length,
      schema: store.gaps.filter((g) => g.type === "SCHEMA_INCONSISTENCY").length,
      brokenRelationships: store.gaps.filter((g) => g.type === "BROKEN_RELATIONSHIP").length,
    },
  }));

  app.get("/admin/cricket/relationships", async () => ({ items: store.relationships.slice(-200) }));
  app.get("/admin/cricket/schema-drift", async () => ({ items: store.schemaNotes, gaps: store.byEndpoint("status") }));
  app.get("/admin/cricket/calls", async () => ({ items: store.calls.slice(-200).reverse() }));
}
