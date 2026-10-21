import type { Json } from "./client";

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