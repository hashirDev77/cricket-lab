import { Link } from "react-router-dom";
import type { Match } from "../api";

function score(side: Match["score"]["home"]) {
  return side.display || (side.runs != null ? `${side.runs}${side.wickets != null ? `/${side.wickets}` : ""}` : "—");
}

export function MatchCard({ match }: { match: Match }) {
  const live = match.status.label === "Live" || match.status.code.toLowerCase().includes("inprogress");
  const tournamentTo = match.tournament.id ? `/tournament/${match.tournament.id}` : undefined;
  return (
    <Link className="card" to={`/match/${match.id}`}>
      <div className="row">
        {tournamentTo ? (
          <span
            className="meta"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = tournamentTo;
            }}
          >
            {match.tournament.name || "Competition"}
          </span>
        ) : (
          <span className="meta">{match.tournament.name || "Competition unknown"}</span>
        )}
        {live ? <span className="live">Live</span> : <span className="badge">{match.status.label}</span>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div>
          <div>{match.homeTeam.name}</div>
          <div className="score">{score(match.score.home)}</div>
        </div>
        <div style={{ color: "var(--muted)" }}>vs</div>
        <div style={{ textAlign: "right" }}>
          <div>{match.awayTeam.name}</div>
          <div className="score">{score(match.score.away)}</div>
        </div>
      </div>
      <div className="meta" style={{ marginTop: 10 }}>
        {match.currentInnings?.label || match.status.description || ""}
        {match.currentInnings?.overs != null ? ` · ${match.currentInnings.overs} overs` : ""}
        {!live && match.startTime ? ` · ${new Date(match.startTime).toLocaleString()}` : ""}
        {match.result ? ` · ${match.result}` : ""}
      </div>
    </Link>
  );
}
