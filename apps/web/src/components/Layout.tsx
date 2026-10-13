import { NavLink, Outlet } from "react-router-dom";

const links = [
  ["/", "Home"],
  ["/live", "Live"],
  ["/matches", "Matches"],
  ["/competitions", "Competitions"],
  ["/teams", "Teams"],
  ["/players", "Players"],
  ["/search", "Search"],
  ["/admin/gaps", "API Gap Dashboard"],
] as const;

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Pitch Lab</strong>
          <span>Cricket product + API gap harness</span>
        </div>
        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">SportsAPI365 cricket · product screens consume /app/cricket · gaps recorded on every provider call</footer>
    </div>
  );
}
