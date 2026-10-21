import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getTournament,
  getTournamentLeaders,
  getTournamentMatches,
  getTournamentSeasons,
  getTournamentStandings,
  getTournaments,
  type Match,
} from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";

export function TournamentPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [seasonId, setSeasonId] = useState<string>("");
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const tournamentId = Number(id);

  useEffect(() => {
    if (!tournamentId) return;
    getTournament(tournamentId)
      .then((data) => {
        setOverview(data);
        setSeasonId(String(data.currentSeasonId || ""));
      })
      .catch((err: Error) => setError(err.message));
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || tab === "overview") return;
    if (tab === "matches") getTournamentMatches(tournamentId).then(setPanel).catch((err: Error) => setError(err.message));
    if (tab === "seasons") getTournamentSeasons(tournamentId).then(setPanel).catch((err: Error) => setError(err.message));
    if (tab === "standings" && seasonId) {
      getTournamentStandings(tournamentId, Number(seasonId), "total").then(setPanel).catch((err: Error) => setError(err.message));
    }
    if (tab === "leaders") getTournamentLeaders(tournamentId, seasonId ? Number(seasonId) : undefined).then(setPanel).catch((err: Error) => setError(err.message));
  }, [tournamentId, tab, seasonId]);

  const tournament = overview?.tournament as { name?: string; country?: string } | undefined;
  const seasons = (overview?.seasons || []) as Array<{ id: number; name: string }>;

  return (
    <DataState loading={!overview && !error} error={error}>
      <h1>{tournament?.name || "Tournament"}</h1>
      <p className="meta">{tournament?.country}</p>
      <label className="meta">
        Season{" "}
        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </label>
      <div className="tabs">
        {["overview", "matches", "standings", "seasons", "leaders"].map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
            {item}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="cards">
          {((overview?.matches || []) as Match[]).map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
      {tab === "matches" && (
        <>
          {((panel as { days?: Array<{ date: string; matches: Match[] }> } | null)?.days || []).map((day) => (
            <section className="group" key={day.date}>
              <h2>{day.date}</h2>
              <div className="cards">
                {day.matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      {tab === "standings" && <Standings data={panel as { columns?: string[]; rows?: Array<Record<string, unknown>> } | null} />}
      {tab === "seasons" && (
        <div className="cards">
          {((panel as { seasons?: Array<{ id: number; name: string }> } | null)?.seasons || seasons).map((season) => (
            <div className="card" key={season.id}>
              {season.name} · {season.id}
            </div>
          ))}
        </div>
      )}
      {tab === "leaders" && (
        <div className="panel">
          <h2>Tournament Leaders</h2>
          <p className="empty">{String((panel as { message?: string } | null)?.message || "Not currently available through a dedicated Cricket endpoint.")}</p>
          <p className="meta">Candidate: {String((panel as { candidate?: string } | null)?.candidate || "")}</p>
        </div>
      )}
    </DataState>
  );
}

function Standings({ data }: { data: { columns?: string[]; rows?: Array<Record<string, unknown>> } | null }) {
  if (!data?.rows) return <div className="state">Loading match data...</div>;
  if (!data.rows.length) return <div className="state empty">No standings available for this season.</div>;
  return (
    <table className="table">
      <thead>
        <tr>
          {(data.columns || ["position", "team", "played", "won", "lost", "nrr", "points"]).map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i}>
            {(data.columns || Object.keys(row)).map((col) => {
              const value = row[col];
              if (col === "team" && value && typeof value === "object" && value && "id" in value) {
                const team = value as { id: number; name: string };
                return (
                  <td key={col}>
                    <Link to={`/team/${team.id}`}>{team.name}</Link>
                  </td>
                );
              }
              return <td key={col}>{String(value ?? "—")}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompetitionsPage() {
  const [data, setData] = useState<{ items: Array<{ id: number; name: string; country?: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getTournaments().then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <>
      <h1>Competitions</h1>
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((item) => (
            <Link className="card" key={item.id} to={`/tournament/${item.id}`}>
              <strong>{item.name}</strong>
              <div className="meta">{item.country}</div>
            </Link>
          ))}
        </div>
      </DataState>
    </>
  );
}