import type { AgentEvent, AgentView } from '../store';

export interface Message {
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
  eventType: string;
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  messages: Message[];
  lastActivity: number;
}

export type AgentConversations = Record<string, Conversation[]>;

function resolveTarget(event: AgentEvent, agentIds: string[]): string | null {
  if (event.meta?.target && agentIds.includes(event.meta.target) && event.meta.target !== event.id) {
    return event.meta.target;
  }
  for (const aid of agentIds) {
    if (aid === event.id) continue;
    if (event.summary.includes(aid)) return aid;
  }
  return null;
}

function upsert(
  convos: AgentConversations,
  agentId: string,
  partnerId: string,
  partnerName: string,
  message: Message
): void {
  if (!convos[agentId]) convos[agentId] = [];
  let convo = convos[agentId].find((c) => c.partnerId === partnerId);
  if (!convo) {
    convo = { partnerId, partnerName, messages: [], lastActivity: 0 };
    convos[agentId].push(convo);
  }
  convo.messages.push(message);
  if (message.ts > convo.lastActivity) convo.lastActivity = message.ts;
}

export function deriveConversations(
  eventLog: AgentEvent[],
  agents: Record<string, AgentView>
): AgentConversations {
  const agentIds = Object.keys(agents);
  const result: AgentConversations = {};

  // Process oldest-first
  const chronological = [...eventLog].reverse();

  for (const event of chronological) {
    const msg: Message = {
      senderId: event.id,
      senderName: event.name,
      text: event.summary,
      ts: event.ts,
      eventType: event.event,
    };

    const targetId = resolveTarget(event, agentIds);

    if (targetId) {
      const targetName = agents[targetId]?.name ?? targetId;
      const senderName = agents[event.id]?.name ?? event.name;
      // sender → target
      upsert(result, event.id, targetId, targetName, msg);
      // target → sender
      upsert(result, targetId, event.id, senderName, msg);
    } else {
      // no target → general
      upsert(result, event.id, '__general__', 'General', msg);
    }
  }

  // Sort each agent's conversations by lastActivity descending
  for (const convos of Object.values(result)) {
    convos.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  return result;
}
