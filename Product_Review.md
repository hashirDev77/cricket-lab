# Cricket Product Review

We built a live cricket product on the SportsAPI365 Cricket API to see if a customer can ship a normal cricket app from the current 39 endpoints. The product covers home, live matches, match centre, search, players, teams and competitions. It works, but several screens only work after extra calls, fallbacks, or by hiding widgets. 

---



## What should be improved in the Cricket API



### Auth

**Today:** `x-apim-key` alone returns 403. `X-Live-Key` alone returns 200. Both keys also return 200.

**Needed:** One written contract. Say which header is required so a customer does not have to guess.

### `GET /v1/cricket/fixtures/today` and `GET /v1/cricket/events`

**Today:** List rows have teams, status and start time. Live scores are not on the list. Tournament name is often missing. Venue is missing. Status is a string (`inprogress` / `notstarted`). Start time is a unix number.

A home screen with 2 live matches needed 4 Cricket API calls (2 list calls + 2 event-detail fallbacks) to show `PAK 98/1` vs `SL 0`.

**Needed on every list row:**

- `homeScore` / `awayScore` (runs, wickets, overs)
- current innings label
- tournament id **and** tournament name
- venue
- the same status object and the same time format as match detail

Without this, every live home page becomes an N+1 problem.

### `GET /v1/cricket/event/{eventId}`

**Today:** Scores, venue and innings text are here (`PAK 98/1`, Rawalpindi, 1st Inning). Status is an object, and the code can be `21` instead of `inprogress`. `uniqueTournament.name` is present. `uniqueTournament.id` is **null**. List rows for the same match already had a tournament id.

**Needed:**

- Always set `uniqueTournament.id` when a tournament name exists
- One status shape on list and detail (`{ code, type, description }`)
- One timestamp type (unix seconds or ISO, not both)
- A clear match-format field (Test / ODI / T20)

Without the tournament id, Match → Tournament navigation breaks.

### `GET /v1/cricket/events?status=finished`

**Today:** `total = 0` on a day when finished matches exist on team pages.

**Needed:** A working Results feed. A Matches → Results tab cannot stay empty while completed games are available on other routes.

### `GET /v1/cricket/event/{id}/innings`

**Today (live T20):** one innings, 11 batting rows. Runs, balls, 4s, 6s are there. Player **name** is missing (only an id). No dismissal text. No extras. No fall of wickets. No partnerships. No innings team name or innings total.

**Needed for a real scorecard:**

- player name + player id
- how out (and fielder if relevant)
- extras (wides, no-balls, byes, leg-byes, penalty)
- fall of wickets
- partnerships
- innings team, runs, wickets, overs

Better still: a single `GET /event/{id}/scorecard`. Building a scorecard from innings + period-scores + overs + ball-by-ball is too much work for a standard cricket page.

### `GET /v1/cricket/event/{id}/ball-by-ball`

**Today:** Useful. Over, ball, batter, bowler, runs and commentary text are present.

**Missing:** score after the ball, extras type, wicket / dismissal type, fielder, timestamp.

### `GET /v1/cricket/event/{id}/overs`

**Today:** Over number, runs and wickets.

**Missing:** balls in the over, bowler, team total after the over, innings id.

### `GET /v1/cricket/event/{id}/best-players`



### `GET /v1/cricket/event/{id}/team-streaks`



### `GET /v1/cricket/event/{id}/enrichments` and `.../enrichments/{type}`

**Today:** 404 on a live match (`Enrichment "best_players" was not found`). Enrichments list is empty.

**Needed:** If the extra is not ready, return **200** with an empty body. A 404 looks like the match does not exist. Keep these optional; do not make them required.

### `GET /v1/cricket/event/{id}/pregame-form`

**Today:** `homeTeam` and `awayTeam` are null on a live international.

**Needed:** Recent form for both sides, or a documented empty object (not a blank that looks broken).

### `GET /v1/cricket/event/{id}/period-scores`

**Today:** A period row exists (`inning1`) but home/away values are null.

**Needed:** Period totals that match the live score.

### `GET /v1/cricket/event/{id}/odds`

**Today:** Markets come back (7 on the live T20). Selection names are `1` / `2`. Prices were missing. This route is also slower than the rest of the feed.

**Needed:** Market name, selection name, price, and market status. Keep it off the first match request if it stays slow.

### `GET /v1/cricket/player/{id}`

**Today (Virat Kohli):** name, current team (RCB), role `BM`.

**Missing:** country, batting style, bowling style, photo. Role should be a readable value (`Batter`), not `BM`.

Search hits have the same problem: id and name only. No photo, country or team.

### `GET /v1/cricket/player/{id}/unique-tournament/{tid}/season/{sid}/statistics`

**Today:** Kohli IPL 2026 returns 200 (matches, innings, 100s, 50s, 4s, 6s, high score). The same season for Rohit Sharma returns **404** (`No season statistics on file`). Field names also differ from what a product expects (`runsScored` instead of `runs`, `battingAverage` instead of `average`). No fielding block.

**Needed:**

- Stats for every squad player in that season, or a clear “not on file” **200**
- One field list: matches, innings, runs, average, strike rate, 100s, 50s, 4s, 6s, high score, wickets, economy, best figures, catches
- A simple `GET /player/{id}/statistics` so the client does not have to already know tournament id + season id



### `GET /v1/cricket/player/{id}/events/last` and `.../next`

**Today:** Match list works (Kohli has a large history). Player figures for that match are not on the row.

**Needed:** Runs / wickets for that player on each recent-match card.

### `GET /v1/cricket/players`

**Today:** Directory works (~8,900 players). Rows are thin: name, id, role `BM`. No country, team, photo or filters.

**Needed:** country, team, role, photo. Query filters for country / team / role.

### `GET /v1/cricket/team/{id}`

**Today:** Name and country. No logo. No manager id on India.

### `GET /v1/cricket/team/{id}/players`

**Today:** India squad returned no players in this run. When players do come back, role is often not enough to group Batters / Keepers / All-rounders / Bowlers.

**Needed:** A stable squad list with name, id, role and photo.

### `GET /v1/cricket/team/{id}/featured-event`

**Today:** This is not the current live match. It can be empty, upcoming, or a finished game.

**Needed:** Document it as an editorial / recommended match. Do not treat it as “live now”. Live should come from `near-events` or `/events?status=inprogress`.

### `GET /v1/cricket/teams` and `GET /v1/cricket/tournaments`

**Today:** Lists work. Team row has name + country code. Tournament row has name only. No logo, category, current season or active flag.

**Needed:** logo, country, category, current season id.

### `GET /v1/cricket/unique-tournament/{id}`

**Today:** IPL name and country. `currentSeasonId` is null. `active` is null. No logo.

**Needed:** current season id, dates, logo, category.

### `GET /v1/cricket/unique-tournament/{id}/events`

**Today:** Returns a mixed / old list (IPL rows from 2013 appeared on the tournament page).

**Needed:** Current-season matches by default, with season id as a filter.

### `GET /v1/cricket/unique-tournament/{id}/season/{sid}/standings/{type}`

**Today:** Table works (10 IPL 2026 rows: position, team, played, won, lost, points).

**Missing:** NRR. `scoresFor` / `scoresAgainst` came back as 0.

**Needed:** P, W, L, NRR, points — only columns that are real.

### Tournament leaders — **no endpoint**

There is no route for Most Runs, Most Wickets, Most Sixes, Best Strike Rate or Best Bowling.

**Needed:** `GET /unique-tournament/{id}/season/{sid}/leaders`

Assembling this from per-player season stats is not practical, and those stats are already missing for some squad players.

### `GET /v1/cricket/manager/{id}`

**Today:** 404 unless a manager id exists on the team. National teams often have no manager id.

Low priority. Only useful as a link from a team page.

---



## Endpoints that would remove the most product pain

1. Scores, overs, innings and tournament id/name on `/fixtures/today` and `/events`
2. `uniqueTournament.id` always set on `/event/{id}`
3. One status + time schema on list and detail
4. A real scorecard payload (names, dismissals, extras, FOW, partnerships)
5. Working `/events?status=finished`
6. Season stats for every squad player, with one field list
7. Tournament leaders
8. 200-empty instead of 404 for optional match extras
9. One published auth header rule

