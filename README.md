# OMP Dashboard — Flexbar Plugin

oh-my-pi (OMP) LLM usage statistics on your Flexbar. Supports **macOS, Windows and Linux**.

## Features

- **Overview** — tap the entry key to open a full-width dashboard: Today stats, 7-day cost trend, top models, agent distribution, recent calls and live rates
- **Standalone keys** — Today, 7-Day Trend, Models, Agents, Recent Calls, Live Monitor
- **Data sync** — runs `omp stats` automatically on start and every 5 minutes so stats are fresh without manual intervention
- **Real-time live rates** — read from OMP's `usage_cost_history` (written per request), 5-minute window

## Data source

- Primary: `~/.omp/stats.db` (SQLite, read-only) — synced by `omp stats`
- Realtime supplement: `~/.omp/agent/agent.db` `usage_cost_history` (Windows: `%USERPROFILE%\.omp\...`)
- Uses Node's built-in `node:sqlite`; falls back to the `sqlite3` CLI on macOS/Linux only (Windows requires Node 22.5+ for `node:sqlite`)

## Build

```bash
npm install
npm run build          # → com.dylanL.ompdashboard.plugin/backend/plugin.cjs
```

## Development (with FlexDesigner running)

```bash
flexcli plugin link --path com.dylanL.ompdashboard.plugin --uuid com.dylanL.ompdashboard
npm run build
flexcli plugin restart --uuid com.dylanL.ompdashboard
```

## Packaging

```bash
flexcli plugin pack --path com.dylanL.ompdashboard.plugin --output dist
```

Push a tag matching `manifest.json` version (e.g. `v1.0.0`) — GitHub Actions builds and attaches the `.flexplugin` to the release.

## License

GNU GPL v3.0 — see [LICENSE](LICENSE).
