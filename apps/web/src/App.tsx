import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage, LivePage } from "./pages/Home";
import { MatchesPage } from "./pages/Matches";
import { MatchPage } from "./pages/Match";
import { SearchPage } from "./pages/Search";
import { PlayerPage, PlayersPage } from "./pages/Player";
import { ManagerPage, TeamPage, TeamsPage } from "./pages/Team";
import { CompetitionsPage, TournamentPage } from "./pages/Tournament";
import { GapDetailPage, GapScreenPage, GapsPage } from "./admin/Gaps";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/player/:id" element={<PlayerPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/team/:id" element={<TeamPage />} />
        <Route path="/manager/:id" element={<ManagerPage />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />
        <Route path="/admin/gaps" element={<GapsPage />} />
        <Route path="/admin/gaps/screen/:screen" element={<GapScreenPage />} />
        <Route path="/admin/gaps/:id" element={<GapDetailPage />} />
      </Route>
    </Routes>
  );
}
