import type { CricketMatch, CricketPlayer } from "../normalize/models.js";
import type { RequestContext } from "../gaps/context.js";

export interface Expectation {
  required: string[];
  requiredWhenLive?: string[];
  preferred?: string[];
}

export const HOME_CARD: Expectation = {
  required: ["id", "homeTeam", "awayTeam", "status", "startTime"],
  requiredWhenLive: ["score", "innings", "overs"],
  preferred: ["tournament", "venue"],
};

export const PLAYER_OVERVIEW: Expectation = {
  required: ["id", "name"],
  preferred: ["team", "country", "role", "battingStyle", "bowlingStyle", "image"],
};

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function evaluateContract(
  ctx: RequestContext,
  endpoint: string,
  component: string,
  data: unknown,
  contract: Expectation,
  live = false,
) {
  const missingRequired: string[] = [];
  for (const field of contract.required) {
    const value = readPath(data, field);
    if (value == null || value === "") {
      missingRequired.push(field);
      ctx.recordGap({
        code: "MISSING_FIELD",
        type: value === null ? "NULL_FIELD" : "MISSING_FIELD",
        severity: "P1",
        component,
        endpoint,
        field,
        expected: `${field} present`,
        actual: value === null ? "null" : "missing",
        userImpact: `Required ${component} field ${field} is not usable.`,
        developerImpact: "HTTP 200 is not enough; the contract field is absent.",
      });
    }
  }
  if (live) {
    for (const field of contract.requiredWhenLive || []) {
      const value = readPath(data, field);
      if (value == null || value === "") {
        ctx.recordGap({
          code: "HOME_MATCH_SCORE_MISSING",
          type: "MISSING_FIELD",
          severity: "P1",
          component,
          endpoint,
          field,
          expected: `${field} on live match card`,
          actual: "missing",
          userImpact: "Live cards cannot show current match state from the list response.",
          developerImpact: "N+1 event-detail requests.",
        });
      }
    }
  }
  for (const field of contract.preferred || []) {
    const value = readPath(data, field);
    if (value == null || value === "") {
      ctx.recordGap({
        code: "PREFERRED_FIELD_MISSING",
        type: "MISSING_FIELD",
        severity: "P3",
        component,
        endpoint,
        field,
        expected: `${field} preferred`,
        actual: "missing",
        userImpact: `Secondary ${component} information is thin.`,
        developerImpact: "Preferred field absent; UI should hide the widget.",
      });
    }
  }
  return missingRequired;
}

export function isLive(match: CricketMatch): boolean {
  const code = match.status.code.toLowerCase();
  const desc = (match.status.description || "").toLowerCase();
  return (
    match.status.label === "Live" ||
    code.includes("inprogress") ||
    desc.includes("inning") ||
    ["7", "13", "21", "31", "32", "45"].includes(match.status.code)
  );
}

export function evaluatePlayerContract(ctx: RequestContext, player: CricketPlayer) {
  evaluateContract(ctx, "/player/{id}", "Player overview", player, PLAYER_OVERVIEW);
}
