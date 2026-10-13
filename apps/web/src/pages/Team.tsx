import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Match, type Player } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";

export function TeamPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson(`/app/cricket/teams/${id}`).then(setOverview).catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "overview") return;
    const path =
      tab === "matches"
        ? `/app/cricket/teams/${id}/matches`
        : tab === "squad"
          ? `/app/cricket/teams/${id}/squad`
          : tab === "performance"
            ? `/app/cricket/teams/${id}/performance`
            : tab === "rankings"
              ? `/app/cricket/teams/${id}/rankings`
              : tab === "competitions"
                ? `/app/cricket/teams/${id}/competitions`
                : `/app/cricket/teams/${id}/media`;
    getJson(path).then(setPanel).catch((err: Error) => setError(err.message));
  }, [id, tab]);

  const team = overview?.team as { id: number; name: string; country?: string; managerId?: number } | undefined;
  return (
    <DataState loading={!overview && !error} error={error}>
      {team && (
        <>
          <h1>{team.name}</h1>
          <p className="meta">{team.country || "Country unknown"}</p>
          <div className="tabs">
            {["overview", "matches", "squad", "performance", "rankings", "competitions", "media"].map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="grid">
              <div className="panel">
                <h2>Previous match</h2>
                {overview?.previousMatch ? <MatchCard match={overview.previousMatch as Match} /> : <p className="empty">No previous match.</p>}
              </div>
              <div className="panel">
                <h2>Next match</h2>
                {overview?.nextMatch ? <MatchCard match={overview.nextMatch as Match} /> : <p className="empty">No next match.</p>}
              </div>
              <div className="panel">
                <h2>Featured event (editorial only)</h2>
                <p className="meta">Not used as the live match. Featured can be finished or empty while the team is playing elsewhere.</p>
                {overview?.featuredEvent ? <MatchCard match={overview.featuredEvent as Match} /> : <p className="empty">No featured event.</p>}
              </div>
              {team.managerId ? (
                <Link className="panel" to={`/manager/${team.managerId}`}>
                  Manager / staff #{String(team.managerId)}
                </Link>
              ) : (
                <div className="panel empty">No manager id on this team payload.</div>
              )}
            </div>
          )}
          {tab === "matches" && <TeamMatches data={panel as { fixtures?: Match[]; results?: Match[] } | null} />}
          {tab === "squad" && <Squad data={panel as { grouped?: Record<string, Player[]>; players?: Player[] } | null} />}
          {tab === "performance" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
          {tab === "rankings" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
          {tab === "competitions" && (
            <div className="cards">
              {((panel as { items?: Array<{ id: number; name: string }> } | null)?.items || []).map((item) => (
                <Link className="card" key={item.id} to={`/tournament/${item.id}`}>
                  {item.name}
                </Link>
              ))}
            </div>
          )}
          {tab === "media" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
        </>
      )}
    </DataState>
  );
}

function TeamMatches({ data }: { data: { fixtures?: Match[]; results?: Match[] } | null }) {
  if (!data) return <div className="state">Loading match data...</div>;
  return (
    <>
      <h2>Fixtures</h2>
      <div className="cards">{(data.fixtures || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
      <h2>Results</h2>
      <div className="cards">{(data.results || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
    </>
  );
}

function Squad({ data }: { data: { grouped?: Record<string, Player[]>; players?: Player[] } | null }) {
  if (!data) return <div className="state">Loading match data...</div>;
  const groups = data.grouped || {};
  return (
    <>
      {Object.entries(groups).map(([name, players]) => (
        <section className="group" key={name}>
          <h2>{name}</h2>
          <div className="cards">
            {players.map((player) => (
              <Link className="card" key={player.id} to={`/player/${player.id}`}>
                {player.name} <div className="meta">{player.role || "Role not available"}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function TeamsPage() {
  const [data, setData] = useState<{ items: Array<{ id: number; name: string }>; audit?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson("/app/cricket/teams").then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <>
      <h1>Teams</h1>
      {data?.audit && <p className="badge">{data.audit}</p>}
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((team) => (
            <Link className="card" key={team.id} to={`/team/${team.id}`}>
              {team.name}
            </Link>
          ))}
        </div>
      </DataState>
    </>
  );
}

export function ManagerPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson(`/app/cricket/managers/${id}`).then(setData).catch((err: Error) => setError(err.message));
  }, [id]);
  return (
    <DataState loading={!data && !error} error={error}>
      <h1>Manager {id}</h1>
      <pre className="panel meta">{JSON.stringify(data, null, 2)}</pre>
    </DataState>
  );
}
