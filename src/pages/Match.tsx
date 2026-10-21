import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getCommentary, getInsights, getMatch, getOdds, getOvers, getScorecard, type Match } from "../api";
import { DataState } from "../components/DataState";

const tabs = ["overview", "scorecard", "commentary", "overs", "insights", "odds"] as const;

function score(side: Match["score"]["home"]) {
  return side.display || "—";
}

export function MatchPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") || "overview") as (typeof tabs)[number];
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);
  const matchId = Number(id);

  useEffect(() => {
    if (!matchId) return;
    setOverview(null);
    getMatch(matchId).then(setOverview).catch((err: Error) => setError(err.message));
  }, [matchId]);

  useEffect(() => {
    if (!matchId || tab === "overview") {
      setPanel(null);
      return;
    }
    setLoadingTab(true);
    const request =
      tab === "scorecard"
        ? getScorecard(matchId)
        : tab === "commentary"
          ? getCommentary(matchId)
          : tab === "overs"
            ? getOvers(matchId)
            : tab === "insights"
              ? getInsights(matchId)
              : getOdds(matchId);
    request
      .then(setPanel)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingTab(false));
  }, [matchId, tab]);

  const match = (overview?.match || (panel as { match?: Match } | null)?.match) as Match | undefined;

  return (
    <DataState loading={!overview && !error} error={error}>
      {overview && (
        <>
          <div className="header-match card">
            <div className="meta">
              {match?.tournament.id ? (
                <Link to={`/tournament/${match.tournament.id}`}>{match.tournament.name}</Link>
              ) : (
                match?.tournament.name || "Tournament unavailable"
              )}
            </div>
            <div className="teams">
              <div>
                <div>
                  {match?.homeTeam.id ? <Link to={`/team/${match.homeTeam.id}`}>{match.homeTeam.name}</Link> : match?.homeTeam.name}
                </div>
                <div className="score">{match ? score(match.score.home) : "—"}</div>
              </div>
              <div className="meta">vs</div>
              <div>
                <div>
                  {match?.awayTeam.id ? <Link to={`/team/${match.awayTeam.id}`}>{match.awayTeam.name}</Link> : match?.awayTeam.name}
                </div>
                <div className="score">{match ? score(match.score.away) : "—"}</div>
              </div>
            </div>
            <div className="meta">
              {match?.status.label === "Live" ? <span className="live">Live</span> : match?.status.label}{" "}
              {match?.currentInnings?.label} {match?.currentInnings?.overs != null ? `· ${match.currentInnings.overs} overs` : ""}{" "}
              {match?.startTime ? `· ${new Date(match.startTime).toLocaleString()}` : ""} {match?.venue ? `· ${match.venue}` : ""}
            </div>
          </div>
          <div className="tabs">
            {tabs.map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && <Overview overview={overview} />}
          {tab !== "overview" && (
            <DataState loading={loadingTab} error={null}>
              {tab === "scorecard" && <Scorecard data={panel as never} />}
              {tab === "commentary" && <Commentary data={panel as never} />}
              {tab === "overs" && <Overs data={panel as never} />}
              {tab === "insights" && <Insights data={panel as never} />}
              {tab === "odds" && <Odds data={panel as never} />}
            </DataState>
          )}
        </>
      )}
    </DataState>
  );
}

function Overview({ overview }: { overview: Record<string, unknown> }) {
  const match = overview.match as Match | undefined;
  const streaks = overview.teamStreaks as { status: string; note?: string };
  const best = overview.bestPlayers as { status: string; note?: string };
  return (
    <div className="grid">
      <div className="panel">
        <h2>Match</h2>
        <p>Tournament: {match?.tournament.name || "—"}</p>
        <p>Venue: {match?.venue || "—"}</p>
        <p>Start: {match?.startTime ? new Date(match.startTime).toLocaleString() : "—"}</p>
        <p>Status: {match?.status.description || match?.status.label}</p>
      </div>
      <div className="panel">
        <h2>Period Scores</h2>
        <pre className="meta">{JSON.stringify(overview.periodScores, null, 2)}</pre>
      </div>
      <div className="panel">
        <h2>Recent Form</h2>
        <pre className="meta">{JSON.stringify(overview.form, null, 2)}</pre>
      </div>
      <div className="panel">
        <h2>Head to Head</h2>
        <pre className="meta">{JSON.stringify(overview.h2h, null, 2)}</pre>
      </div>
      <div className="panel">
        <h2>Team Streaks</h2>
        <p className="empty">{streaks?.note || (streaks?.status !== "SUPPORTED" ? "Team streak information is not available for this match." : "")}</p>
        {streaks?.status === "SUPPORTED" && <pre className="meta">{JSON.stringify(streaks, null, 2)}</pre>}
      </div>
      <div className="panel">
        <h2>Best Players</h2>
        <p className="empty">{best?.note || (best?.status !== "SUPPORTED" ? "Best player information is not available for this match." : "")}</p>
        {best?.status === "SUPPORTED" && <pre className="meta">{JSON.stringify(best, null, 2)}</pre>}
      </div>
    </div>
  );
}

function Scorecard({ data }: { data: { innings?: Array<Record<string, unknown>> } | null }) {
  if (!data?.innings?.length) return <div className="state empty">No scorecard is available for this match.</div>;
  return (
    <>
      {data.innings.map((inning, idx) => (
        <div className="panel group" key={String(inning.id ?? idx)}>
          <h2>
            {String(inning.teamName || `Innings ${idx + 1}`)} {inning.runs != null ? `${inning.runs}/${inning.wickets ?? ""}` : ""}{" "}
            {inning.overs != null ? `${inning.overs} overs` : ""}
          </h2>
          <h3>Batting</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Dismissal</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {((inning.batting as Array<Record<string, unknown>>) || []).map((row, i) => (
                <tr key={i}>
                  <td>{row.playerId ? <Link to={`/player/${row.playerId}`}>{String(row.name || "—")}</Link> : String(row.name || "—")}</td>
                  <td>{String(row.dismissal || "—")}</td>
                  <td>{String(row.runs ?? "—")}</td>
                  <td>{String(row.balls ?? "—")}</td>
                  <td>{String(row.fours ?? "—")}</td>
                  <td>{String(row.sixes ?? "—")}</td>
                  <td>{String(row.strikeRate ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta">Extras: {JSON.stringify(inning.extras)}</p>
          <p className="meta">Fall of wickets: {((inning.fallOfWickets as unknown[]) || []).length ? JSON.stringify(inning.fallOfWickets) : "Not available"}</p>
          <p className="meta">Partnerships: {((inning.partnerships as unknown[]) || []).length ? JSON.stringify(inning.partnerships) : "Not available"}</p>
          <h3>Bowling</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {((inning.bowling as Array<Record<string, unknown>>) || []).map((row, i) => (
                <tr key={i}>
                  <td>{String(row.name || "—")}</td>
                  <td>{String(row.overs ?? "—")}</td>
                  <td>{String(row.maidens ?? "—")}</td>
                  <td>{String(row.runs ?? "—")}</td>
                  <td>{String(row.wickets ?? "—")}</td>
                  <td>{String(row.economy ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function Commentary({ data }: { data: { overs?: Array<{ over: unknown; balls: Array<Record<string, unknown>> }> } | null }) {
  if (!data?.overs?.length) return <div className="state empty">No commentary is available for this match.</div>;
  return (
    <div className="grid">
      {data.overs.map((over) => (
        <div className="panel" key={String(over.over)}>
          <h2>Over {String(over.over)}</h2>
          {over.balls.map((ball, i) => (
            <p key={i}>
              <strong>
                {String(ball.over)}.{String(ball.ball)}
              </strong>{" "}
              {String(ball.bowler || "Bowler")} to {String(ball.batter || "Batter")} · {ball.wicket ? "W" : String(ball.runs ?? "·")}{" "}
              {ball.commentary ? `— ${ball.commentary}` : ""} {ball.scoreAfter ? `· ${ball.scoreAfter}` : ""}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Overs({ data }: { data: { overs?: Array<Record<string, unknown>>; progression?: Array<{ over: unknown; score: string }> } | null }) {
  if (!data?.overs?.length) return <div className="state empty">No over summaries are available for this match.</div>;
  return (
    <div className="grid">
      {data.overs.map((over, i) => (
        <div className="panel" key={i}>
          <h2>Over {String(over.over)}</h2>
          <div className="overs">
            {((over.balls as string[]) || []).map((ball, idx) => (
              <span className="ball-chip" key={idx}>
                {ball || "·"}
              </span>
            ))}
          </div>
          <p className="meta">
            {String(over.runs ?? 0)} runs · {String(over.wickets ?? 0)} wickets {over.bowler ? `· ${over.bowler}` : ""}
          </p>
        </div>
      ))}
      <div className="panel">
        <h2>Score progression</h2>
        {(data.progression || []).map((row) => (
          <p key={String(row.over)}>
            Over {String(row.over)} · {row.score}
          </p>
        ))}
      </div>
    </div>
  );
}

function Insights({ data }: { data: { components?: Record<string, { status: string; data?: unknown }> } | null }) {
  const components = data?.components || {};
  return (
    <div className="grid">
      {Object.entries(components).map(([name, item]) => (
        <div className="panel" key={name}>
          <div className="row">
            <h2>{name}</h2>
            <span className="badge">{item.status}</span>
          </div>
          {item.status === "SUPPORTED" ? (
            <pre className="meta">{JSON.stringify(item.data ?? item, null, 2)}</pre>
          ) : (
            <p className="empty">This insight is not available ({item.status}).</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Odds({ data }: { data: { markets?: Array<{ name: string; selections: Array<{ name: string; price: unknown }> }>; responseTime?: number } | null }) {
  if (!data?.markets?.length) return <div className="state empty">No odds are available for this match.</div>;
  return (
    <>
      <p className="meta">
        Loaded on tab open · {data.responseTime} ms · {data.markets.length} markets
      </p>
      {data.markets.map((market, i) => (
        <div className="panel group" key={i}>
          <h2>{market.name || "Market"}</h2>
          {market.selections.map((sel, idx) => (
            <div className="row" key={idx}>
              <span>{sel.name}</span>
              <strong>{String(sel.price ?? "—")}</strong>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
