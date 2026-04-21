# Hacker HQ

## Project Overview

Pixel-art web UI for watching Codex agents work in real-time. Agents appear as hackers with chat bubbles. Dual-channel reporting: hooks provide automatic heartbeats, agents self-report semantic status via `curl`. Express relay server, React frontend. Two views: **Scene** (pixel-art agent sprites with chat bubbles) and **Messages** (iMessage-style conversation wall). All local, no external infrastructure.

## Tech Stack

- **Backend:** Express + `ws` (WebSocket), TypeScript, run via `npx tsx server.ts`
- **Frontend:** React + TypeScript (Vite), Zustand state management, `reconnecting-websocket`, `react-router-dom`
- **Styling:** CSS pixel art sprites (no image assets), CSS animations for bubbles
- **No external deps:** No Redis, no database, no API keys — everything is localhost

## Architecture

```
Agent Layer (Codex instances)
  ├── Hooks (postToolUse) → POST /heartbeat (automatic liveness)
  └── Self-report (curl) → POST /event (semantic status)
         ↓
Relay Server (Express + ws, port 3001)
  ├── In-memory Map<agentId, AgentState>
  ├── WebSocket fan-out to dashboard clients
  └── 300s liveness timeout → "disconnected"
         ↓
Frontend (React + Vite, port 5173)
  ├── reconnecting-websocket → Zustand store
  ├── Routes: /scene, /messages
  ├── Scene: pixel-art agent sprites (3 states: working/idle/error) with chat bubbles
  ├── Messages: iMessage-style conversation wall
  └── Transmission Log (last 50 events)
```

## Key Schemas

### AgentEvent (POST /event)
```typescript
{ id: string, name: string, event: string, summary: string, ts: number, meta?: { tool?, file?, target? } }
```
Events: `task_start`, `working`, `done`, `error`, `idle` — server adds `disconnected` synthetically.

### Heartbeat (POST /heartbeat)
```typescript
{ id: string, ts: number }
```
Updates `lastSeen` only. No display change unless reviving from disconnected.

## Design Decisions

1. **Dual-channel (hooks + self-report)** — hooks guarantee liveness, self-report adds semantic context. Neither alone suffices.
2. **Server-side timestamps** — server stamps `Date.now()` on all events/heartbeats. Agents never send timestamps.
3. **Fire-and-forget curl** — all agent curl commands end with `> /dev/null 2>&1 || true`. Dashboard failures must never surface to agents.
4. **In-memory state** — no persistence. Agents re-announce within 300s. Restarts are rare.
5. **CORS enabled** — Vite dev server (:5173) needs to reach Express (:3001).
6. **3 sprite states** — `working`, `idle`, `error`. Mapping: `task_start`/`working` → working, `done`/`idle` → idle, `error`/`disconnected` → error.

## Project Structure

```
server.ts               — Express relay server (HTTP + WebSocket)
index.html              — Vite entry
vite.config.ts          — Vite config
tsconfig.json           — TypeScript config
package.json
src/
  main.tsx              — React entry
  App.tsx               — Layout, router, header, transmission log
  store.ts              — Zustand store (agents, eventLog, connected)
  ws.ts                 — reconnecting-websocket client
  api.ts                — REST helpers for the relay server
  dashboardTheme.ts     — Theme tokens
  components/
    Scene.tsx             — Scene view (agent sprites + background)
    SceneAgent.tsx        — Single agent in the scene (sprite + bubble)
    IMessageWall.tsx      — Messages view
    PhoneScreen.tsx       — iMessage-style phone frame
    ConversationThread.tsx — Thread of messages within a conversation
    MessageBubble.tsx     — Single iMessage-style bubble
    ChatBubble.tsx        — Animated pixel-art speech bubble
    EventLog.tsx          — Transmission log (last 50 events)
  sprites/
    PixelHacker.tsx       — CSS box-shadow pixel art (3 states)
    SceneBackground.tsx   — Pixel-art background for the scene
  utils/
    deriveConversations.ts — Group events into conversation threads
  styles/                 — CSS files per component
```

## Build & Dev

### Build
```bash
npm run build
```

### Development
Run the relay server and frontend in two terminals:

```bash
# Terminal 1 — Express relay + WebSocket (port 3001)
npx tsx server.ts
# or: npm run dev:server

# Terminal 2 — Vite dev server (port 5173)
npm run dev
```

Open `http://localhost:5173` to view the dashboard.

## Agent Reporting

Agents report status to the relay server at `http://localhost:3001`.

**Endpoints:**
- `POST /event` — semantic status: `{ id, name, event, summary }`
- `POST /heartbeat` — liveness ping: `{ id }`

**Event types:** `task_start`, `working`, `done`, `error`, `idle`

**Curl template (fire-and-forget):**
```bash
curl -s -X POST http://localhost:3001/event \
  -H "Content-Type: application/json" \
  -d '{"id":"<agent-id>","name":"<display-name>","event":"<event-type>","summary":"<what is happening>"}' \
  > /dev/null 2>&1 || true
```

**Rules:**
- Never use single quotes inside summary strings (breaks the curl command)
- All curls must end with `> /dev/null 2>&1 || true` — dashboard failures must never surface to agents
- Report at natural breakpoints: starting a task, after major steps, on completion, on errors
