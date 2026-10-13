export async function getJson<T = any>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((body as { error?: string }).error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export interface Meta {
  calls: { minimum: number; actual: number; fallback: number; sequential: number; parallel: number };
  gaps: Array<{ id: string; code: string; type: string; severity: string; expected: string; actual: string }>;
}

export interface TeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
}

export interface Match {
  id: number;
  status: { code: string; label: string; description?: string | null };
  startTime: string | null;
  tournament: { id: number | null; name: string | null };
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: {
    home: { runs: number | null; wickets: number | null; overs: number | null; display: string | null };
    away: { runs: number | null; wickets: number | null; overs: number | null; display: string | null };
  };
  currentInnings: { label: string | null; overs: number | null } | null;
  venue: string | null;
  result: string | null;
}

export interface Player {
  id: number;
  name: string | null;
  team: TeamRef | null;
  country: string | null;
  role: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  image: string | null;
}
