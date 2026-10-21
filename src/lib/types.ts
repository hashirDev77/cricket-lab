export interface CricketStatus {
  code: string;
  label: string;
  description?: string | null;
}

export interface CricketScore {
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  display: string | null;
  runRate?: number | null;
  source: "list" | "event" | "innings" | "derived" | "missing";
}

export interface CricketTeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  country?: string | null;
  logo?: string | null;
}

export interface CricketTournamentRef {
  id: number | null;
  name: string | null;
}

export interface CricketMatch {
  id: number;
  status: CricketStatus;
  startTime: string | null;
  tournament: CricketTournamentRef;
  homeTeam: CricketTeamRef;
  awayTeam: CricketTeamRef;
  score: { home: CricketScore; away: CricketScore };
  currentInnings: {
    label: string | null;
    overs: number | null;
    battingTeamId: number | null;
  } | null;
  venue: string | null;
  format: string | null;
  result: string | null;
}

export interface CricketPlayer {
  id: number;
  name: string | null;
  team: CricketTeamRef | null;
  country: string | null;
  role: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  image: string | null;
}

export interface CricketTournament {
  id: number;
  name: string | null;
  country: string | null;
  category: string | null;
  logo: string | null;
  currentSeasonId: number | null;
  active: boolean | null;
}

export interface CricketSeason {
  id: number;
  name: string | null;
  year: string | null;
}

export interface CricketInnings {
  id: number | string | null;
  teamId: number | null;
  teamName: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  batting: CricketBatterRow[];
  bowling: CricketBowlerRow[];
  extras: Record<string, number | null>;
  fallOfWickets: Array<{ wicket: number | null; score: number | null; player: string | null }>;
  partnerships: Array<{ players: string; runs: number | null; balls: number | null }>;
}

export interface CricketBatterRow {
  playerId: number | null;
  name: string | null;
  dismissal: string | null;
  runs: number | null;
  balls: number | null;
  fours: number | null;
  sixes: number | null;
  strikeRate: number | null;
}

export interface CricketBowlerRow {
  playerId: number | null;
  name: string | null;
  overs: number | null;
  maidens: number | null;
  runs: number | null;
  wickets: number | null;
  economy: number | null;
  wides: number | null;
  noBalls: number | null;
}

export interface CricketBall {
  over: number | null;
  ball: number | null;
  batter: string | null;
  batterId: number | null;
  bowler: string | null;
  bowlerId: number | null;
  runs: number | null;
  extras: string | null;
  wicket: boolean | null;
  dismissalType: string | null;
  fielder: string | null;
  scoreAfter: string | null;
  commentary: string | null;
  timestamp: string | null;
}

export interface CricketStanding {
  position: number | null;
  team: CricketTeamRef;
  played: number | null;
  won: number | null;
  lost: number | null;
  nrr: number | null;
  points: number | null;
  raw: Record<string, unknown>;
}

export interface CricketOddsMarket {
  name: string | null;
  status: string | null;
  selections: Array<{ name: string | null; price: number | string | null }>;
}

export interface SearchHit {
  type: "player" | "team" | "tournament" | "unknown";
  id: number | null;
  name: string | null;
  image?: string | null;
  country?: string | null;
  team?: string | null;
  competition?: string | null;
}
