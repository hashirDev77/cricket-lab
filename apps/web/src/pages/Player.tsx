import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Match, type Player } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";

export function PlayerPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<{ player: Player; rawMissing: string[] } | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [matches, setMatches] = useState<{ recent: Match[]; upcoming: Match[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ player: Player; rawMissing: string[] }>(`/app/cricket/players/${id}`)
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "statistics") {
      getJson(`/app/cricket/players/${id}/statistics`).then(setStats).catch((err: Error) => setError(err.message));
    }
    if (tab === "recent" || tab === "upcoming") {
      getJson<{ recent: Match[]; upcoming: Match[] }>(`/app/cricket/players/${id}/matches`)
        .then(setMatches)
        .catch((err: Error) => setError(err.message));
    }
  }, [id, tab]);

  const player = overview?.player;
  return (
    <DataState loading={!overview && !error} error={error}>
      {player && (
        <>
          <h1>{player.name}</h1>
          <p className="meta">
            {player.team?.id ? <Link to={`/team/${player.team.id}`}>{player.team.name}</Link> : player.team?.name || "Team unknown"} ·{" "}
            {player.country || "Country unknown"} · {player.role || "Role unknown"}
          </p>
          <p className="meta">
            {player.battingStyle || "Batting style not available"} · {player.bowlingStyle || "Bowling style not available"}
          </p>
          <div className="tabs">
            {["overview", "statistics", "recent", "upcoming"].map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="panel">
              <p>Missing profile fields: {overview?.rawMissing.join(", ") || "none recorded"}</p>
            </div>
          )}
          {tab === "statistics" && (
            <DataState loading={!stats} error={null} empty={Boolean(stats && stats.available === false)} emptyText="No statistics available for this season.">
              {stats && stats.available !== false && (
                <div className="grid">
                  <div className="panel">
                    <h2>Batting</h2>
                    <pre className="meta">{JSON.stringify(stats.batting, null, 2)}</pre>
                  </div>
                  <div className="panel">
                    <h2>Bowling</h2>
                    <pre className="meta">{JSON.stringify(stats.bowling, null, 2)}</pre>
                  </div>
                  <div className="panel">
                    <h2>Fielding</h2>
                    <pre className="meta">{JSON.stringify(stats.fielding, null, 2)}</pre>
                  </div>
                </div>
              )}
            </DataState>
          )}
          {tab === "recent" && (
            <div className="cards">
              {(matches?.recent || []).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
          {tab === "upcoming" && (
            <div className="cards">
              {(matches?.upcoming || []).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </>
      )}
    </DataState>
  );
}

export function PlayersPage() {
  const [data, setData] = useState<{ items: Player[]; audit?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson<{ items: Player[]; audit?: string }>("/app/cricket/players").then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <>
      <h1>Players</h1>
      {data?.audit && <p className="badge">{data.audit}</p>}
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((player) => (
            <Link className="card" key={player.id} to={`/player/${player.id}`}>
              <strong>{player.name}</strong>
              <div className="meta">{player.country || player.role || ""}</div>
            </Link>
          ))}
        </div>
      </DataState>
    </>
  );
}
