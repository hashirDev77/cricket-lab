import type { Json } from "./types.js";

export function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function unwrapEntity(body: Json | null, key: string): Json | null {
  if (!body) return null;
  const nested = asRecord(body[key]);
  if (nested) return nested;
  if (body.id != null || body.name != null) return body;
  return null;
}

const LIST_KEYS = [
  "items",
  "events",
  "seasons",
  "players",
  "overs",
  "types",
  "markets",
  "periods",
  "media",
  "rankings",
  "uniqueTournaments",
  "uniqueTournamentSeasons",
  "tournamentSeasons",
] as const;

export function unwrapList(body: Json | null): unknown[] {
  if (!body) return [];
  for (const key of LIST_KEYS) {
    if (Array.isArray(body[key])) return body[key] as unknown[];
  }
  return [];
}

export function listArrayKey(body: Json | null): string | null {
  if (!body) return null;
  const keys = [
    "items",
    "events",
    "seasons",
    "players",
    "overs",
    "types",
    "markets",
    "periods",
    "uniqueTournamentSeasons",
    "tournamentSeasons",
    "standings",
    "innings",
  ];
  return keys.find((key) => Array.isArray(body[key])) ?? null;
}

export function unwrapEvent(body: Json | null): Json | null {
  return unwrapEntity(body, "event");
}

export function unwrapPlayer(body: Json | null): Json | null {
  return unwrapEntity(body, "player");
}

export function unwrapTeam(body: Json | null): Json | null {
  return unwrapEntity(body, "team");
}

export function unwrapTournament(body: Json | null): Json | null {
  return unwrapEntity(body, "uniqueTournament");
}

export function unwrapStandingsRows(body: Json | null): unknown[] {
  const standings = asArray(body?.standings);
  const first = asRecord(standings[0]);
  return asArray(first?.rows);
}

export function isEmptyPayload(body: Json | null): boolean {
  if (!body) return true;
  const list = unwrapList(body);
  if (list.length > 0) return false;
  if (unwrapEvent(body) || unwrapPlayer(body) || unwrapTeam(body) || unwrapTournament(body)) return false;
  if (asArray(body.innings).length > 0) return false;
  if (asArray(body.standings).length > 0) return false;
  if (asRecord(body.statistics)) return false;
  if (asRecord(body.teamDuel) || asRecord(body.managerDuel)) return false;
  return Object.keys(body).length === 0 || (list.length === 0 && !body.event && !body.player && !body.team);
}

export function isOptionalEnrichment404(result: { status: number; body: Json | null; error?: string }): boolean {
  if (result.status !== 404) return false;
  const message = String(result.body?.message || result.error || "").toLowerCase();
  return message.includes("enrichment") || message.includes("no season statistics");
}
