import { create } from 'zustand';

export type MovementState = 'entering' | 'at_desk' | 'walking_to_meet' | 'meeting' | 'walking_back' | 'leaving' | 'walking_to_bed' | 'walking_to_kitchen' | 'at_bed';

const COLS = 9;
const MIN_COL_GAP = 2;

export const DESK_POSITIONS: { x: number; y: number }[] = (() => {
  const positions: { x: number; y: number }[] = [];
  const X_START = 50;
  const X_GAP = 120;
  const Y_ROWS = [140, 290];
  // Checkerboard pass: alternate rows per column for vertical stagger
  for (let c = 0; c < COLS; c++) {
    positions.push({ x: X_START + c * X_GAP, y: Y_ROWS[c % 2] });
  }
  // Overflow pass: fill the opposite row for each column
  for (let c = 0; c < COLS; c++) {
    positions.push({ x: X_START + c * X_GAP, y: Y_ROWS[(c + 1) % 2] });
  }
  return positions;
})();

export const BED_POSITIONS = DESK_POSITIONS.map(p => ({ x: p.x + 80, y: p.y + 40 }));

export interface BubbleEntry {
  text: string;
  id: number;
}

export interface AgentView {
  id: string;
  name: string;
  event: string;
  summary: string;
  sprite: 'cooking' | 'sleeping' | 'error';
  lastSeen: number;
  bubbleHistory: BubbleEntry[];
  position: { x: number; y: number };
  deskPosition: { x: number; y: number };
  bedPosition: { x: number; y: number };
  movementState: MovementState;
  facing: 'left' | 'right';
  targetAgent?: string;
  meetingQueue: string[];
}

export interface AgentEvent {
  id: string;
  name: string;
  event: string;
  summary: string;
  ts: number;
  meta?: { tool?: string; file?: string; target?: string };
}

interface Store {
  agents: Record<string, AgentView>;
  eventLog: AgentEvent[];
  connected: boolean;
  handleEvent: (e: AgentEvent) => void;
  loadSnapshot: (agents: AgentEvent[]) => void;
  setConnected: (v: boolean) => void;
  setAgentPosition: (id: string, pos: { x: number; y: number }) => void;
  transitionComplete: (agentId: string) => void;
}

function toSprite(event: string): 'cooking' | 'sleeping' | 'error' {
  if (event === 'error' || event === 'disconnected') return 'error';
  if (event === 'done' || event === 'idle') return 'sleeping';
  return 'cooking';
}

function getNextDeskPosition(agents: Record<string, AgentView>): { x: number; y: number } {
  const taken = new Set(
    Object.values(agents).map((a) => `${a.deskPosition.x},${a.deskPosition.y}`)
  );
  const occupiedCols = Object.values(agents).map((a) => {
    const idx = DESK_POSITIONS.findIndex(
      (p) => p.x === a.deskPosition.x && p.y === a.deskPosition.y
    );
    return idx % COLS;
  });

  // Filter candidates: untaken and >= MIN_COL_GAP from all occupied columns
  const valid: { pos: { x: number; y: number }; col: number }[] = [];
  for (let i = 0; i < DESK_POSITIONS.length; i++) {
    const pos = DESK_POSITIONS[i];
    if (taken.has(`${pos.x},${pos.y}`)) continue;
    const col = i % COLS;
    const farEnough = occupiedCols.every(
      (oc) => Math.abs(col - oc) >= MIN_COL_GAP
    );
    if (farEnough) valid.push({ pos, col });
  }
  if (valid.length > 0) return valid[0].pos;

  // Fallback: pick the untaken slot with the largest minimum gap
  let best: { x: number; y: number } = DESK_POSITIONS[DESK_POSITIONS.length - 1];
  let bestGap = -1;
  for (let i = 0; i < DESK_POSITIONS.length; i++) {
    const pos = DESK_POSITIONS[i];
    if (taken.has(`${pos.x},${pos.y}`)) continue;
    const col = i % COLS;
    const minGap = occupiedCols.length === 0
      ? COLS
      : Math.min(...occupiedCols.map((oc) => Math.abs(col - oc)));
    if (minGap > bestGap) {
      bestGap = minGap;
      best = pos;
    }
  }
  return best;
}

function processMovement(
  existing: AgentView | undefined,
  updated: AgentView,
  newEvent: string
): Partial<AgentView> {
  // Case 1: First-seen agent — start off-screen to animate walk-in
  if (!existing) {
    return {
      movementState: 'entering',
      position: { x: -100, y: updated.deskPosition.y },
      facing: 'right',
    };
  }

  // Case 3: Re-entering while leaving — cancel leave, snap to desk
  if (
    existing.movementState === 'leaving' &&
    (newEvent === 'working' || newEvent === 'task_start')
  ) {
    return {
      movementState: 'entering',
      position: { ...updated.deskPosition },
      facing: 'right',
    };
  }

  // Case 2: Leaving — disconnected while at desk or bed
  if (
    (existing.movementState === 'at_desk' || existing.movementState === 'at_bed') &&
    newEvent === 'disconnected'
  ) {
    return {
      movementState: 'leaving',
      position: { x: 1300, y: updated.deskPosition.y },
      facing: 'right',
    };
  }

  // Case 4: Walk to bed — sleeping while at desk
  if (
    existing.movementState === 'at_desk' &&
    updated.sprite === 'sleeping'
  ) {
    return {
      movementState: 'walking_to_bed',
      position: { ...updated.bedPosition },
      facing: updated.bedPosition.x > existing.position.x ? 'right' : 'left',
    };
  }

  // Case 5: Walk to kitchen — cooking while at bed
  if (
    existing.movementState === 'at_bed' &&
    updated.sprite === 'cooking'
  ) {
    return {
      movementState: 'walking_to_kitchen',
      position: { ...updated.deskPosition },
      facing: updated.deskPosition.x < existing.position.x ? 'left' : 'right',
    };
  }

  return {};
}

function triggerMeeting(
  initiatorId: string,
  targetId: string,
  agents: Record<string, AgentView>
): Record<string, Partial<AgentView>> | null {
  const initiator = agents[initiatorId];
  const target = agents[targetId];
  if (!initiator || !target) return null;
  if (initiator.movementState !== 'at_desk' || target.movementState !== 'at_desk') return null;

  const midX = (initiator.deskPosition.x + target.deskPosition.x) / 2;
  const meetY = 380;

  return {
    [initiatorId]: {
      movementState: 'walking_to_meet',
      position: { x: midX - 50, y: meetY },
      facing: 'right' as const,
      targetAgent: targetId,
    },
    [targetId]: {
      movementState: 'walking_to_meet',
      position: { x: midX + 50, y: meetY },
      facing: 'left' as const,
      targetAgent: initiatorId,
    },
  };
}

function detectMeetingTarget(
  e: AgentEvent,
  agents: Record<string, AgentView>
): string | null {
  // Explicit: meta.target pointing to a known agent at their desk
  if (e.meta?.target && agents[e.meta.target] && agents[e.meta.target].movementState === 'at_desk') {
    return e.meta.target;
  }
  // Heuristic: scan summary for known agent IDs
  const agentIds = Object.keys(agents);
  for (const aid of agentIds) {
    if (aid === e.id) continue;
    if (e.summary.includes(aid) && agents[aid].movementState === 'at_desk') {
      return aid;
    }
  }
  return null;
}

// Module-level timer refs (not serializable in Zustand state)
const meetingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const disconnectRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
const idleRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();

function meetingPairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

// 9.2.2: Stagger simultaneous walk animations to prevent overlap
function staggeredUpdate(
  set: (fn: (state: Store) => Partial<Store>) => void,
  updates: Record<string, Partial<AgentView>>
) {
  for (const [aid, patch] of Object.entries(updates)) {
    setTimeout(() => {
      set((state) => {
        if (!state.agents[aid]) return state;
        return {
          agents: {
            ...state.agents,
            [aid]: { ...state.agents[aid], ...patch },
          },
        };
      });
    }, 200 + Math.random() * 200);
  }
}

const useStore = create<Store>()((set, get) => ({
  agents: {},
  eventLog: [],
  connected: false,

  handleEvent: (e) => {
    // 13.1.2: Handle 'removed' event — delete agent immediately, skip upsert
    if (e.event === 'removed') {
      const pending = disconnectRemovalTimers.get(e.id);
      if (pending) { clearTimeout(pending); disconnectRemovalTimers.delete(e.id); }
      const idlePending = idleRemovalTimers.get(e.id);
      if (idlePending) { clearTimeout(idlePending); idleRemovalTimers.delete(e.id); }
      set((state) => {
        const { [e.id]: _, ...rest } = state.agents;
        return {
          agents: rest,
          eventLog: [e, ...state.eventLog].slice(0, 50),
        };
      });
      return;
    }

    set((state) => {
      const existing = state.agents[e.id];
      const bubbleHistory = [
        { text: e.summary, id: e.ts },
        ...(existing?.bubbleHistory ?? []),
      ].slice(0, 3);

      const deskPosition = existing?.deskPosition ?? getNextDeskPosition(state.agents);
      const bedPosition = existing?.bedPosition ?? { x: deskPosition.x + 80, y: deskPosition.y + 40 };
      const agent: AgentView = {
        id: e.id,
        name: e.name,
        event: e.event,
        summary: e.summary,
        sprite: toSprite(e.event),
        lastSeen: e.ts,
        bubbleHistory,
        position: existing?.position ?? { ...deskPosition },
        deskPosition,
        bedPosition,
        movementState: existing?.movementState ?? 'at_desk',
        facing: existing?.facing ?? 'right',
        targetAgent: existing?.targetAgent,
        meetingQueue: existing?.meetingQueue ?? [],
      };

      const movement = processMovement(existing, agent, e.event);
      Object.assign(agent, movement);

      return {
        agents: { ...state.agents, [e.id]: agent },
        eventLog: [e, ...state.eventLog].slice(0, 50),
      };
    });

    // Remove disconnected agents after walk-off animation completes
    if (e.event === 'disconnected') {
      const timer = setTimeout(() => {
        disconnectRemovalTimers.delete(e.id);
        set((s) => {
          const { [e.id]: _, ...rest } = s.agents;
          return { agents: rest };
        });
      }, 3_000);
      disconnectRemovalTimers.set(e.id, timer);
    } else {
      const pending = disconnectRemovalTimers.get(e.id);
      if (pending) {
        clearTimeout(pending);
        disconnectRemovalTimers.delete(e.id);
      }
    }

    // 13.1.3: Idle auto-cleanup — remove agents idle/done for 2 minutes
    if (e.event === 'idle' || e.event === 'done') {
      // Clear any existing idle timer before starting a new one
      const existingIdle = idleRemovalTimers.get(e.id);
      if (existingIdle) { clearTimeout(existingIdle); idleRemovalTimers.delete(e.id); }

      const idleTimer = setTimeout(() => {
        idleRemovalTimers.delete(e.id);
        // Trigger leaving animation
        set((s) => {
          const agent = s.agents[e.id];
          if (!agent) return s;
          return {
            agents: {
              ...s.agents,
              [e.id]: {
                ...agent,
                movementState: 'leaving' as MovementState,
                position: { x: 1300, y: agent.deskPosition.y },
                facing: 'right' as const,
              },
            },
          };
        });
        // Remove agent after walk-off animation completes
        setTimeout(() => {
          set((s) => {
            const { [e.id]: _, ...rest } = s.agents;
            return { agents: rest };
          });
        }, 3_000);
      }, 120_000);
      idleRemovalTimers.set(e.id, idleTimer);
    } else {
      // Cancel idle timer on any non-idle/non-done event
      const idlePending = idleRemovalTimers.get(e.id);
      if (idlePending) {
        clearTimeout(idlePending);
        idleRemovalTimers.delete(e.id);
      }
    }

    // Meeting trigger: detect if this event implies a meeting with another agent
    const agents = get().agents;
    const sender = agents[e.id];
    if (sender && sender.movementState === 'at_desk') {
      const targetId = detectMeetingTarget(e, agents);
      if (targetId) {
        const updates = triggerMeeting(e.id, targetId, agents);
        if (updates) {
          staggeredUpdate(set, updates);
        } else {
          // Target is busy — queue the meeting request on the target
          const target = agents[targetId];
          if (target && !target.meetingQueue.includes(e.id)) {
            set((state) => {
              const t = state.agents[targetId];
              if (!t) return state;
              return {
                agents: {
                  ...state.agents,
                  [targetId]: { ...t, meetingQueue: [...t.meetingQueue, e.id] },
                },
              };
            });
          }
        }
      }
    }
  },

  loadSnapshot: (agents) =>
    set({
      agents: Object.fromEntries(
        agents.map((e, i) => {
          const deskPosition = DESK_POSITIONS[i] ?? DESK_POSITIONS[DESK_POSITIONS.length - 1];
          const bedPosition = { x: deskPosition.x + 80, y: deskPosition.y + 40 };
          return [
            e.id,
            {
              id: e.id,
              name: e.name,
              event: e.event,
              summary: e.summary,
              sprite: toSprite(e.event),
              lastSeen: e.ts,
              bubbleHistory: [],
              position: { ...deskPosition },
              deskPosition,
              bedPosition,
              movementState: 'at_desk' as MovementState,
              facing: 'right' as const,
              meetingQueue: [],
            },
          ];
        })
      ),
    }),

  setConnected: (v) => set({ connected: v }),

  setAgentPosition: (id, pos) =>
    set((state) => {
      const agent = state.agents[id];
      if (!agent) return state;
      return {
        agents: { ...state.agents, [id]: { ...agent, position: pos } },
      };
    }),

  transitionComplete: (agentId) => {
    const state = get();
    const agent = state.agents[agentId];
    if (!agent) return;

    switch (agent.movementState) {
      case 'entering': {
        set((s) => ({
          agents: {
            ...s.agents,
            [agentId]: { ...s.agents[agentId], movementState: 'at_desk', position: { ...s.agents[agentId].deskPosition } },
          },
        }));
        break;
      }

      case 'walking_to_meet': {
        // Set this agent to 'meeting'
        set((s) => ({
          agents: {
            ...s.agents,
            [agentId]: { ...s.agents[agentId], movementState: 'meeting' },
          },
        }));

        // Check if partner is also in 'meeting' state now
        const updated = get().agents;
        const partnerId = agent.targetAgent;
        if (!partnerId) break;
        const partner = updated[partnerId];
        if (!partner || partner.movementState !== 'meeting') break;

        // Both in meeting — start 5s timer
        const pairKey = meetingPairKey(agentId, partnerId);
        if (meetingTimers.has(pairKey)) break; // already ticking

        const timer = setTimeout(() => {
          meetingTimers.delete(pairKey);
          const current = get();
          const a = current.agents[agentId];
          const b = current.agents[partnerId];
          if (!a || !b) return;
          staggeredUpdate(set, {
            [agentId]: {
              movementState: 'walking_back' as MovementState,
              position: { ...a.deskPosition },
              facing: (a.deskPosition.x < a.position.x ? 'left' : 'right') as const,
            },
            [partnerId]: {
              movementState: 'walking_back' as MovementState,
              position: { ...b.deskPosition },
              facing: (b.deskPosition.x < b.position.x ? 'left' : 'right') as const,
            },
          });
        }, 5000);
        meetingTimers.set(pairKey, timer);
        break;
      }

      case 'walking_back': {
        // Return to desk, clear targetAgent, process meeting queue
        set((s) => {
          const a = s.agents[agentId];
          if (!a) return s;
          return {
            agents: {
              ...s.agents,
              [agentId]: {
                ...a,
                movementState: 'at_desk',
                position: { ...a.deskPosition },
                targetAgent: undefined,
                meetingQueue: a.meetingQueue,
              },
            },
          };
        });

        // Process queued meeting requests
        const afterReturn = get().agents[agentId];
        if (afterReturn && afterReturn.meetingQueue.length > 0) {
          const queue = [...afterReturn.meetingQueue];
          const nextMeetingTarget = queue.shift()!;
          // Clear the queue first
          set((s) => ({
            agents: {
              ...s.agents,
              [agentId]: { ...s.agents[agentId], meetingQueue: queue },
            },
          }));
          // Try to trigger meeting with queued agent
          const currentAgents = get().agents;
          const updates = triggerMeeting(nextMeetingTarget, agentId, currentAgents);
          if (updates) {
            staggeredUpdate(set, updates);
          }
        }
        break;
      }

      case 'walking_to_bed': {
        set((s) => ({
          agents: {
            ...s.agents,
            [agentId]: { ...s.agents[agentId], movementState: 'at_bed', position: { ...s.agents[agentId].bedPosition } },
          },
        }));
        break;
      }

      case 'walking_to_kitchen': {
        set((s) => ({
          agents: {
            ...s.agents,
            [agentId]: { ...s.agents[agentId], movementState: 'at_desk', position: { ...s.agents[agentId].deskPosition } },
          },
        }));
        break;
      }

      case 'leaving':
      case 'at_desk':
      case 'at_bed':
      case 'meeting':
      default:
        break;
    }
  },
}));

export default useStore;
