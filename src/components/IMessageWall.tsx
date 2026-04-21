import { useMemo } from 'react';
import useStore from '../store';
import { deriveConversations } from '../utils/deriveConversations';
import PhoneScreen from './PhoneScreen';
import '../styles/IMessageWall.css';

export default function IMessageWall() {
  const agents = useStore((s) => s.agents);
  const eventLog = useStore((s) => s.eventLog);

  const conversations = useMemo(
    () => deriveConversations(eventLog, agents),
    [eventLog, agents]
  );

  return (
    <section className="view-shell messages-view">
      <div className="dashboard-surface">
        <div className="section-header">
          <div>
            <h2 className="section-title">Message Mirrors</h2>
            <p className="section-caption">
              Private and broadcast summaries rendered as per-agent terminal threads.
            </p>
          </div>
          <span className="section-pill">{Object.keys(agents).length} active channels</span>
        </div>

        <div className="imessage-wall">
          {Object.keys(agents).map((id) => (
            <PhoneScreen
              key={id}
              agentId={id}
              agent={agents[id]}
              conversations={conversations[id] ?? []}
              allAgents={agents}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
