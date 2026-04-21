# Hacker HQ

Dashboard for watching your Claude Code agents work in real-time.

![Screenshot](docs/screenshot.png)

## What it does

Hacker HQ is a local dashboard that visualizes Claude Code agents as cute robots. Each agent appears as a sprite with a chat bubble showing what it's currently doing, and an iMessage-style threaded view lets you follow conversations between agents and their tools in real-time.

Everything runs locally — there's no database, no external API, and no telemetry. The relay server holds state in memory and fans events out to the browser over WebSocket.

## Quick Start

```bash
npm install
```

In **terminal 1**, start the relay server:

```bash
npx tsx server.ts
```

In **terminal 2**, start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

Then, in any Claude Code session, run:

```
/setup-hooks
```

Your agents will start appearing on the dashboard as they work.

## How it works

```
  Claude Code agent
        │
        │ hook fires
        ▼
  POST /hook ──────────► Relay server (Express, :3001)
                                │
                                │ WebSocket fan-out
                                ▼
                          Browser (React, :5173)
```

1. A Claude Code hook fires on each tool use and posts a payload to the relay server.
2. The relay server normalizes the event, updates in-memory state, and broadcasts it over WebSocket.
3. The React frontend subscribes via a reconnecting WebSocket and renders each agent as a robot sprite, with chat bubbles for the latest event and a threaded message wall for full history.

Agents can also `POST /event` directly from curl for semantic status updates ("starting task X", "encountered error Y"), giving you richer signals than hooks alone provide.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Agent Layer                                             │
│    ├── Claude Code hooks ─► POST /hook (liveness)        │
│    └── curl self-reports  ─► POST /event (semantic)      │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Relay Server (Express + ws, :3001)                      │
│    ├── In-memory Map<agentId, AgentState>                │
│    ├── WebSocket fan-out to dashboard clients            │
│    └── 300s liveness timeout ─► "disconnected"           │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Frontend (React + Vite, :5173)                          │
│    ├── Scene view     — robot agent sprites               │
│    └── Messages view  — iMessage-style threaded log      │
└──────────────────────────────────────────────────────────┘
```

## Agent Events Reference

Agents report status through two endpoints.

### `POST /event`

Semantic status update from an agent.

```json
{
  "id": "dev-01",
  "name": "dev-01",
  "event": "working",
  "summary": "Running the test suite"
}
```

**Event types:**

| Event        | Meaning                                                  |
|--------------|----------------------------------------------------------|
| `task_start` | Agent has begun a new task                               |
| `working`    | Agent is actively working (default state)                |
| `done`       | Task finished successfully                               |
| `error`      | Agent hit an error                                       |
| `idle`       | Agent is idle and waiting                                |

The server also emits a synthetic `disconnected` event when no heartbeat arrives within 300 seconds.

### `POST /heartbeat`

Liveness ping. Updates the agent's `lastSeen` timestamp without changing displayed status.

```json
{ "id": "dev-01" }
```

Heartbeats are normally sent automatically by the Claude Code hook — you won't need to post these by hand.

### Curl template

Copy-paste-ready, fire-and-forget:

```bash
curl -s -X POST http://localhost:3001/event \
  -H "Content-Type: application/json" \
  -d '{"id":"dev-01","name":"dev-01","event":"working","summary":"Running the test suite"}' \
  > /dev/null 2>&1 || true
```

The trailing `> /dev/null 2>&1 || true` ensures dashboard failures never break your agent's workflow.

## Configuration

The frontend reads two optional environment variables at build time:

| Variable              | Default                      | Purpose                       |
|-----------------------|------------------------------|-------------------------------|
| `VITE_API_BASE_URL`   | `http://localhost:3001`      | Relay server HTTP base URL    |
| `VITE_WS_URL`         | `ws://localhost:3001`        | Relay server WebSocket URL    |

Set these in a `.env` file at the project root if you're running the relay on a different host or port.

## Tech Stack

- **Backend** — Express 5, `ws` 8, TypeScript, run via `tsx`
- **Frontend** — React 19, Vite 7, TypeScript
- **State** — Zustand 5
- **WebSocket client** — reconnecting-websocket
- **Styling** — CSS robot sprites (no image assets), CSS animations

No database. No external services. No API keys.

## License

See [LICENSE](LICENSE).
