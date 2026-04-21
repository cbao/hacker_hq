import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

interface AgentState {
  event: any;
  lastSeen: number;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const agents = new Map<string, AgentState>();
const teammateToAgent = new Map<string, string>();
const lastBroadcast = new Map<string, number>();

app.post('/event', (req, res) => {
  const { id, event, summary } = req.body;
  if (!id || !event || !summary) {
    res.status(400).json({ error: 'missing id, event, or summary' });
    return;
  }
  req.body.ts = Date.now();
  agents.set(id, { event: req.body, lastSeen: Date.now() });
  broadcast(req.body);
  res.json({ ok: true });
});

app.post('/heartbeat', (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: 'missing id' });
    return;
  }
  const now = Date.now();
  const existing = agents.get(id);
  if (existing) {
    existing.lastSeen = now;
    if (existing.event.event === 'disconnected') {
      const reviveEvent = { ...existing.event, event: 'working', summary: 'Back online', ts: now };
      existing.event = reviveEvent;
      broadcast(reviveEvent);
    }
  } else {
    const initEvent = { id, name: id, event: 'working', summary: 'Agent connected', ts: now };
    agents.set(id, { event: initEvent, lastSeen: now });
    broadcast(initEvent);
  }
  res.json({ ok: true });
});

app.post('/hook', (req, res) => {
  const payload = req.body;
  const agentId = resolveAgentId(payload);
  const now = Date.now();

  if (payload.agent_id && payload.agent_type) {
    teammateToAgent.set(payload.agent_type, payload.agent_id);
  }

  const existing = agents.get(agentId);
  if (existing) {
    existing.lastSeen = now;
    if (payload.teammate_name && payload.teammate_name !== existing.event.name) {
      existing.event.name = payload.teammate_name;
    }
  }

  const dashEvent = translateHook(payload, agentId, now);
  if (!dashEvent) return res.json({ ok: true });

  if (shouldBroadcast(agentId, dashEvent, now)) {
    agents.set(agentId, { event: dashEvent, lastSeen: now });
    broadcast(dashEvent);
  }

  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(3001, () => {
  console.log('Hacker HQ relay on :3001');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const snapshot = Array.from(agents.values()).map((s) => s.event);
  ws.send(JSON.stringify({ type: 'snapshot', agents: snapshot }));
});

setInterval(() => {
  const now = Date.now();
  for (const [id, state] of agents) {
    if (now - state.lastSeen > 60_000 && state.event.event !== 'disconnected') {
      const disconnected = {
        id,
        name: state.event.name,
        event: 'disconnected',
        summary: 'Went silent — crashed or finished',
        ts: now,
      };
      state.event = disconnected;
      broadcast(disconnected);
    }
  }
  // Purge agents disconnected for over 2 minutes
  for (const [id, state] of agents) {
    if (now - state.lastSeen > 120_000 && state.event.event === 'disconnected') {
      const removed = { id, name: state.event.name, event: 'removed', summary: 'Agent removed', ts: now };
      agents.delete(id);
      broadcast(removed);
    }
  }
}, 10_000);

function truncate(s: string, max = 80): string {
  if (!s) return '...';
  return s.length <= max ? s : s.slice(0, max - 1) + '\u2026';
}

function shortenPath(p?: string): string {
  if (!p) return '...';
  const parts = p.split('/');
  return parts.length > 4 ? parts.slice(-4).join('/') : p;
}

const BASH_TRUNCATE_LIMIT = 120;

function summarizeTool(payload: any): string {
  const input = payload.tool_input || {};
  switch (payload.tool_name) {
    case 'Bash':
      return truncate('Running: ' + input.command, BASH_TRUNCATE_LIMIT);
    case 'Edit':
      return truncate('Editing: ' + shortenPath(input.file_path));
    case 'Write':
      return truncate('Writing: ' + shortenPath(input.file_path));
    case 'Read':
      return truncate('Reading: ' + shortenPath(input.file_path));
    case 'Grep':
      return truncate('Searching: ' + input.pattern);
    case 'Glob':
      return truncate('Finding: ' + input.pattern);
    case 'Agent':
      return truncate('Delegating: ' + (input.description || input.subagent_type));
    case 'WebFetch':
      return truncate('Fetching: ' + input.url);
    case 'WebSearch':
      return truncate('Searching: ' + input.query);
    case 'ToolSearch':
      return truncate('Looking up: ' + input.query);
    case 'Skill':
      return truncate('Running: /' + (input.skill || 'skill'));
    case 'LSP':
      return truncate('Code intel: ' + (input.action || 'query'));
    case 'NotebookEdit':
      return truncate('Editing notebook: ' + shortenPath(input.notebook_path));
    case 'TodoWrite':
      return truncate('Updating tasks');
    case 'TaskCreate':
      return truncate('Creating task: ' + truncate(input.description || '', 60));
    case 'TaskUpdate':
      return truncate('Updating task');
    default:
      if (payload.tool_name?.startsWith('mcp__')) {
        const parts = payload.tool_name.split('__');
        return truncate((parts[2] || parts[1]) + ' via ' + parts[1]);
      }
      return truncate('Using: ' + payload.tool_name);
  }
}

function resolveAgentId(payload: any): string {
  if (payload.agent_id) return payload.agent_id;
  if (payload.teammate_name && teammateToAgent.has(payload.teammate_name))
    return teammateToAgent.get(payload.teammate_name)!;
  return payload.session_id;
}

function resolveDisplayName(payload: any): string {
  if (payload.teammate_name) return payload.teammate_name;
  if (payload.agent_type) return payload.agent_type;
  const cwd: string = payload.cwd || '';
  const parts = cwd.split('/').filter(Boolean);
  return parts.length > 0 ? parts.slice(-2).join('/') : 'agent';
}

function translateHook(payload: any, agentId: string, ts: number): Record<string, any> | null {
  const base = { id: agentId, name: resolveDisplayName(payload), ts };
  switch (payload.hook_event_name) {
    case 'PostToolUse':
      return {
        ...base,
        event: 'working',
        summary: summarizeTool(payload),
        meta: { tool: payload.tool_name, file: payload.tool_input?.file_path },
      };
    case 'PostToolUseFailure':
      return {
        ...base,
        event: 'error',
        summary: truncate('Error: ' + payload.tool_name + ': ' + (payload.error || 'unknown')),
      };
    case 'SubagentStart':
      return {
        ...base,
        event: 'task_start',
        summary: truncate('Spawned: ' + (payload.agent_type || 'subagent')),
      };
    case 'SubagentStop':
      return {
        ...base,
        event: 'done',
        summary: truncate('Finished: ' + (payload.agent_type || 'subagent')),
      };
    case 'TaskCompleted':
      return {
        ...base,
        event: 'done',
        summary: truncate('Completed: ' + (payload.task_subject || payload.task_id)),
      };
    case 'TeammateIdle':
      return {
        ...base,
        event: 'idle',
        summary: truncate('Idle: ' + (payload.teammate_name || 'teammate')),
      };
    case 'Stop':
      return { ...base, event: 'idle', summary: 'Response complete' };
    case 'SessionStart':
      return { ...base, event: 'task_start', summary: 'Session started' };
    case 'SessionEnd':
      return { ...base, event: 'idle', summary: 'Session ended' };
    default:
      return null;
  }
}

function shouldBroadcast(agentId: string, event: any, now: number): boolean {
  if (event.event !== 'working') return true;
  const last = lastBroadcast.get(agentId);
  if (last !== undefined && now - last < 3000) return false;
  lastBroadcast.set(agentId, now);
  return true;
}

function broadcast(data: any) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
