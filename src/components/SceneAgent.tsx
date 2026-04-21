import { useEffect } from 'react';
import useStore from '../store';
import type { AgentView } from '../store';
import PixelHacker from '../sprites/PixelHacker';
import type { SpriteState } from '../sprites/PixelHacker';
import ChatBubble from './ChatBubble';
import '../styles/SceneAgent.css';

function spriteForMovement(agent: AgentView): SpriteState {
  switch (agent.movementState) {
    case 'entering':
    case 'walking_to_meet':
    case 'walking_back':
    case 'leaving':
    case 'walking_to_bed':
    case 'walking_to_kitchen':
      return `walking-${agent.facing}` as SpriteState;
    case 'meeting':
      return 'standing';
    case 'at_desk':
    default:
      return agent.sprite;
  }
}

function extractRole(agentId: string): string | undefined {
  const prefix = agentId.split('-')[0];
  if (['dev', 'rev', 'res', 'test'].includes(prefix)) return prefix;
  return undefined;
}

function formatName(raw: string): string {
  const parts = raw.split('/');
  const short = parts[parts.length - 1] || raw;
  return short.length > 16 ? short.slice(0, 14) + '...' : short;
}

export default function SceneAgent({ agentId }: { agentId: string }) {
  const agent = useStore((s) => s.agents[agentId]);
  const setAgentPosition = useStore((s) => s.setAgentPosition);

  // Proximity-based bubble alignment: find closest neighbor within 200px horizontally
  const proximityAlign = useStore((s) => {
    const me = s.agents[agentId];
    if (!me || me.bubbleHistory.length === 0) return undefined;
    let closest: { id: string; x: number; dist: number } | null = null;
    for (const other of Object.values(s.agents)) {
      if (other.id === agentId || other.bubbleHistory.length === 0) continue;
      const dist = Math.abs(me.position.x - other.position.x);
      if (dist < 200 && (!closest || dist < closest.dist)) {
        closest = { id: other.id, x: other.position.x, dist };
      }
    }
    if (!closest) return undefined;
    return me.position.x <= closest.x ? 'left' as const : 'right' as const;
  });

  // Two-step enter trick: render off-screen first, then on the next frame
  // update position to desk so CSS transition animates the walk-in.
  useEffect(() => {
    if (!agent || agent.movementState !== 'entering' || agent.position.x >= 0) return;
    const rafId = requestAnimationFrame(() => {
      setAgentPosition(agentId, agent.deskPosition);
    });
    return () => cancelAnimationFrame(rafId);
  }, [agent?.movementState, agent?.position.x, agentId, setAgentPosition, agent?.deskPosition]);

  if (!agent) return null;

  const { position, sprite, name, event, bubbleHistory, movementState, facing } = agent;
  const visualState = spriteForMovement(agent);
  const transition =
    movementState === 'entering' || movementState === 'leaving'
      ? 'transform 0.92s cubic-bezier(0.22, 1, 0.36, 1)'
      : movementState === 'walking_to_meet' ||
          movementState === 'walking_back' ||
          movementState === 'walking_to_bed' ||
          movementState === 'walking_to_kitchen'
        ? 'transform 0.76s cubic-bezier(0.22, 1, 0.36, 1)'
        : 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)';
  const meetingAlign = movementState === 'meeting'
    ? (facing === 'right' ? 'left' : 'right') as 'left' | 'right'
    : undefined;
  const bubbleAlign = meetingAlign ?? proximityAlign;

  return (
    <div
      className="scene-agent"
      data-agent-id={agentId}
      data-motion={movementState}
      data-state={sprite}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition,
        zIndex: Math.floor(position.y),
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'transform') {
          useStore.getState().transitionComplete(agentId);
        }
      }}
    >
      <ChatBubble bubbleHistory={bubbleHistory} align={bubbleAlign} spriteState={sprite} />
      <div className="sprite-wrapper" data-state={sprite}>
        <PixelHacker state={visualState} role={extractRole(agentId)} />
      </div>
      <div className="agent-shadow" />
      <div className="scene-agent-label" data-state={sprite}>
        {sprite === 'error' && <span className="status-dot" />}
        {formatName(name || agentId)}
      </div>
    </div>
  );
}
