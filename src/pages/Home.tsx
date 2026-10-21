import { useEffect, useState } from "react";
import { getHome, type Match } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";

interface HomeData {
  live: Match[];
  today: Match[];
  upcoming: Match[];
  completed: Match[];
}

function Section({ title, matches }: { title: string; matches: Match[] }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {matches.length ? (
        <div className="cards">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="state empty">No matches in this section right now.</div>
      )}
    </section>
  );
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getHome().then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <DataState loading={!data && !error} error={error}>
      {data && (
        <>
          <h1>Cricket Home</h1>
          <Section title="Live Now" matches={data.live} />
          <Section title="Today's Matches" matches={data.today} />
          <Section title="Upcoming Matches" matches={data.upcoming} />
          <Section title="Recently Completed" matches={data.completed} />
        </>
      )}
    </DataState>
  );
}

export function LivePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getHome().then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <DataState loading={!data && !error} error={error} empty={Boolean(data && !data.live.length)} emptyText="No live matches right now.">
      {data && (
        <>
          <h1>Live</h1>
          <div className="cards">
            {data.live.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </>
      )}
    </DataState>
  );
}
