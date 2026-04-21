import { useState, useEffect } from 'react';
import type { AgentView } from '../store';
import type { Conversation } from '../utils/deriveConversations';
import ConversationThread from './ConversationThread';

interface PhoneScreenProps {
  agentId: string;
  agent: AgentView;
  conversations: Conversation[];
  allAgents: Record<string, AgentView>;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function avatarLabel(partnerId: string): string {
  if (partnerId === '__general__') return '>_';
  return partnerId.slice(0, 3).toUpperCase();
}

function statusDotColor(sprite: 'cooking' | 'sleeping' | 'error'): string {
  if (sprite === 'cooking') return '#98d894';
  if (sprite === 'sleeping') return '#8fcfba';
  return '#d87782';
}

export default function PhoneScreen({ agentId, agent, conversations, allAgents }: PhoneScreenProps) {
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeConvoId || !conversations.find(c => c.partnerId === activeConvoId)) {
      setActiveConvoId(conversations[0]?.partnerId ?? null);
    }
  }, [conversations, activeConvoId]);

  const activeConvo = conversations.find(c => c.partnerId === activeConvoId);

  return (
    <article className="phone-frame" data-state={agent.sprite}>
      <div className="phone-status-bar">
        <div>
          <div className="phone-agent-name">{agent.name || agentId}</div>
          <div className="phone-agent-id">{agentId}</div>
        </div>
        <span className="phone-state-chip">
          <span
            className="status-dot"
            style={{ background: statusDotColor(agent.sprite) }}
          />
          {agent.event}
        </span>
      </div>

      <div className="phone-screen">
        {activeConvoId && activeConvo ? (
          <>
            <div className="thread-header">
              <button
                className="thread-back"
                onClick={() => setActiveConvoId(null)}
                type="button"
              >
                back
              </button>
              <span className="thread-partner-name">{activeConvo.partnerName}</span>
              <span className="thread-partner-meta">
                {activeConvo.messages.length} msg
              </span>
            </div>
            <ConversationThread
              messages={activeConvo.messages}
              ownerId={agentId}
              partnerSprite={allAgents[activeConvoId]?.sprite}
            />
          </>
        ) : (
          <div className="convo-list">
            {conversations.length === 0 ? (
              <div className="convo-empty">
                No routed conversation history yet. Waiting for relay traffic.
              </div>
            ) : null}
            {conversations.map(convo => {
              const lastMsg = convo.messages[convo.messages.length - 1];
              return (
                <div
                  key={convo.partnerId}
                  className="convo-list-item"
                  onClick={() => setActiveConvoId(convo.partnerId)}
                >
                  <div className="convo-avatar">
                    {avatarLabel(convo.partnerId)}
                  </div>
                  <div className="convo-info">
                    <div className="convo-name">{convo.partnerName}</div>
                    <div className="convo-preview">
                      {lastMsg ? lastMsg.text.slice(0, 40) + (lastMsg.text.length > 40 ? '...' : '') : ''}
                    </div>
                  </div>
                  <div className="convo-time">
                    {lastMsg ? relativeTime(lastMsg.ts) : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="phone-footer">
        <span>summary //</span>
        <span>{agent.summary}</span>
      </div>
    </article>
  );
}
