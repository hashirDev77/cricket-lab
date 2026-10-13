import { CATALOG } from "../raw/catalog.js";
import { store } from "./store.js";
import type { QualityScores, Severity } from "./types.js";

const SCREEN_AREAS = [
  "Home",
  "Match overview",
  "Scorecard",
  "Commentary",
  "Player statistics",
  "Team pages",
  "Tournament pages",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreFromGaps(screen: string): QualityScores {
  const gaps = store.byScreen(screen);
  const calls = store.calls.filter((call) => call.screen.toLowerCase() === screen.toLowerCase());
  const p0 = gaps.filter((gap) => gap.severity === "P0").length;
  const p1 = gaps.filter((gap) => gap.severity === "P1").length;
  const p2 = gaps.filter((gap) => gap.severity === "P2").length;
  const missing = gaps.filter((gap) => gap.type === "MISSING_FIELD" || gap.type === "NULL_FIELD").length;
  const schema = gaps.filter((gap) => gap.type === "SCHEMA_INCONSISTENCY" || gap.type === "STATUS_INCONSISTENCY").length;
  const extra = gaps.filter((gap) => gap.type === "EXTRA_REQUEST_REQUIRED" || gap.type === "DERIVATION_REQUIRED").length;
  const slow = calls.filter((call) => call.ms >= 800).length;
  const failed = calls.filter((call) => call.status >= 500 || call.status === 0).length;
  const ok = calls.filter((call) => call.status === 200).length;

  const availability = clamp(100 - failed * 25 - p0 * 40);
  const completeness = clamp(100 - missing * 8 - p1 * 6);
  const consistency = clamp(100 - schema * 12);
  const freshness = clamp(100 - gaps.filter((gap) => gap.type === "STALE_DATA").length * 15);
  const performance = clamp(100 - slow * 8);
  const developerUsability = clamp(100 - extra * 10 - p2 * 3 - (ok === 0 && calls.length > 0 ? 20 : 0));
  const overall = clamp(
    availability * 0.2 +
      completeness * 0.25 +
      consistency * 0.15 +
      freshness * 0.1 +
      performance * 0.1 +
      developerUsability * 0.2,
  );
  return { availability, completeness, consistency, freshness, performance, developerUsability, overall };
}

export function coverageByScreen() {
  const screens = new Set([
    ...SCREEN_AREAS,
    ...store.gaps.map((gap) => gap.screen),
    ...store.calls.map((call) => call.screen),
  ]);
  return [...screens].map((screen) => {
    const gaps = store.byScreen(screen);
    const scores = scoreFromGaps(screen);
    const broken = gaps.filter((gap) => gap.severity === "P0").length;
    const partial = gaps.filter((gap) => gap.severity === "P1" || gap.severity === "P2").length;
    const complete = Math.max(0, 100 - broken * 20 - partial * 8);
    return {
      screen,
      complete,
      partial: Math.min(100, partial * 8),
      broken: Math.min(100, broken * 20),
      scores,
      gapCount: gaps.length,
    };
  });
}

export function endpointHealth() {
  return CATALOG.map((route) => {
    const gaps = store.byEndpoint(route.path.replace(/\{.*?\}/g, ""));
    const calls = store.calls.filter((call) => call.endpoint.includes(route.path.split("/")[1] || route.path));
    const last = calls[calls.length - 1];
    return {
      ...route,
      lastStatus: last?.status ?? null,
      lastMs: last?.ms ?? null,
      callCount: calls.length,
      gapCount: gaps.length,
      worstSeverity: worst(gaps.map((gap) => gap.severity)),
    };
  });
}

function worst(values: Severity[]): Severity | null {
  if (values.includes("P0")) return "P0";
  if (values.includes("P1")) return "P1";
  if (values.includes("P2")) return "P2";
  if (values.includes("P3")) return "P3";
  return null;
}
