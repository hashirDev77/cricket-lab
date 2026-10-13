import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJson } from "../api";

interface Gap {
  id: string;
  code: string;
  type: string;
  severity: string;
  screen: string;
  component: string;
  endpoint: string;
  expected: string;
  actual: string;
}

interface Coverage {
  screens: Array<{ screen: string; complete: number; partial: number; broken: number; scores: Record<string, number>; gapCount: number }>;
  totals: Record<string, number>;
  endpoints: Array<{ path: string; screen: string; status: string; lastStatus: number | null; lastMs: number | null; gapCount: number }>;
}

export function GapsPage() {
  const [gaps, setGaps] = useState<{ gaps: Gap[]; recommendations: Array<{ title: string; body: string }> } | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [rels, setRels] = useState<{ items: Array<Record<string, unknown>> } | null>(null);
  const [drift, setDrift] = useState<{ items: Array<Record<string, unknown>> } | null>(null);

  useEffect(() => {
    getJson("/admin/cricket/gaps").then(setGaps);
    getJson("/admin/cricket/coverage").then(setCoverage);
    getJson("/admin/cricket/relationships").then(setRels);
    getJson("/admin/cricket/schema-drift").then(setDrift);
  }, []);

  return (
    <>
      <h1>API Gap Dashboard</h1>
      <p className="meta">Product usability health, not just endpoint uptime.</p>
      <div className="kpi">
        {coverage &&
          Object.entries(coverage.totals).map(([key, value]) => (
            <div className="card" key={key}>
              <b>{value}</b>
              <span className="meta">{key}</span>
            </div>
          ))}
      </div>
      <h2>Screen coverage</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Area</th>
            <th>Complete</th>
            <th>Partial</th>
            <th>Broken</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          {(coverage?.screens || []).map((row) => (
            <tr key={row.screen}>
              <td>
                <Link to={`/admin/gaps/screen/${encodeURIComponent(row.screen)}`}>{row.screen}</Link>
              </td>
              <td>{row.complete}%</td>
              <td>{row.partial}%</td>
              <td>{row.broken}%</td>
              <td>{row.scores.overall}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Recommendations</h2>
      {(gaps?.recommendations || []).map((rec) => (
        <div className="panel group" key={rec.title}>
          <h3>{rec.title}</h3>
          <p>{rec.body}</p>
        </div>
      ))}
      <h2>Gaps</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Code</th>
            <th>Screen</th>
            <th>Endpoint</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {(gaps?.gaps || []).map((gap) => (
            <tr key={gap.id}>
              <td className={`sev-${gap.severity}`}>{gap.severity}</td>
              <td>
                <Link to={`/admin/gaps/${gap.id}`}>{gap.code}</Link>
              </td>
              <td>{gap.screen}</td>
              <td>{gap.endpoint}</td>
              <td>{gap.expected}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Relationships</h2>
      <pre className="panel meta">{JSON.stringify(rels?.items || [], null, 2)}</pre>
      <h2>Schema drift</h2>
      <pre className="panel meta">{JSON.stringify(drift?.items || [], null, 2)}</pre>
      <h2>Raw endpoint matrix</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Route</th>
            <th>Screen</th>
            <th>Catalog</th>
            <th>Last</th>
            <th>ms</th>
            <th>Gaps</th>
          </tr>
        </thead>
        <tbody>
          {(coverage?.endpoints || []).map((row) => (
            <tr key={row.path}>
              <td>{row.path}</td>
              <td>{row.screen}</td>
              <td>{row.status}</td>
              <td>{row.lastStatus ?? "—"}</td>
              <td>{row.lastMs ?? "—"}</td>
              <td>{row.gapCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function GapDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (id) getJson(`/admin/cricket/gaps/${id}`).then(setData);
  }, [id]);
  const gap = data?.gap as Record<string, unknown> | undefined;
  return (
    <>
      <h1>{String(gap?.code || "Gap")}</h1>
      {gap && (
        <div className="panel">
          <p>Affected endpoint: {String(gap.endpoint)}</p>
          <p>Affected screen: {String(gap.screen)}</p>
          <p>Affected component: {String(gap.component)}</p>
          <p>Expected: {String(gap.expected)}</p>
          <p>Actual: {String(gap.actual)}</p>
          <p>Fallback: {String(gap.fallback || "none")}</p>
          <p>Extra requests: {String(gap.extraCalls ?? 0)}</p>
          <p>User impact: {String(gap.userImpact)}</p>
          <p>Developer impact: {String(gap.developerImpact)}</p>
          <p>Recommendation: {String(gap.recommendation || "—")}</p>
        </div>
      )}
    </>
  );
}

export function GapScreenPage() {
  const { screen = "" } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    getJson(`/admin/cricket/gaps/screen/${encodeURIComponent(screen)}`).then(setData);
  }, [screen]);
  return (
    <>
      <h1>{screen}</h1>
      <pre className="panel meta">{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}
