import { Fragment, useMemo } from 'react';
import useStore, { BED_POSITIONS, DESK_POSITIONS } from '../store';
import '../styles/SceneBackground.css';

const WINDOW_POSITIONS = [82, 288, 494, 700, 906];
const MEETING_HUB = { x: 446, y: 388 };

export default function SceneBackground() {
  const agents = useStore((s) => s.agents);

  const occupiedSlots = useMemo(() => {
    const agentList = Object.values(agents);
    return DESK_POSITIONS.map((pos, i) => {
      const agent = agentList.find((entry) => entry.deskPosition.x === pos.x && entry.deskPosition.y === pos.y);
      if (!agent) return null;
      const sleeping = agent.movementState === 'at_bed' || agent.movementState === 'walking_to_bed';
      return { pos, bedPos: BED_POSITIONS[i], sleeping };
    }).filter((slot): slot is NonNullable<typeof slot> => slot !== null);
  }, [agents]);

  return (
    <div className="scene-background">
      <div className="scene-background__ceiling scene-background__ceiling--left" />
      <div className="scene-background__ceiling scene-background__ceiling--right" />
      <div className="scene-background__wall-strip" />
      <div className="scene-background__floor-glow" />
      <div className="scene-background__floor-grid" />

      {WINDOW_POSITIONS.map((left, index) => (
        <div key={`window-${left}`} className="scene-window" style={{ left, top: 58 }} data-index={index}>
          <span className="scene-window__shine" />
          <span className="scene-window__crossbar scene-window__crossbar--vertical" />
          <span className="scene-window__crossbar scene-window__crossbar--horizontal" />
          <span className="scene-window__signal" />
        </div>
      ))}

      {occupiedSlots.map(({ pos, bedPos, sleeping }) => (
        <Fragment key={`station-${pos.x}-${pos.y}`}>
          <div
            className="scene-workstation"
            data-sleeping={sleeping ? 'true' : 'false'}
            style={{ left: pos.x - 18, top: pos.y + 58 }}
          >
            <span className="scene-workstation__surface" />
            <span className="scene-workstation__screen scene-workstation__screen--left" />
            <span className="scene-workstation__screen scene-workstation__screen--right" />
            <span className="scene-workstation__burner scene-workstation__burner--left" />
            <span className="scene-workstation__burner scene-workstation__burner--right" />
            <span className="scene-workstation__underlight" />
          </div>

          <div className="scene-recovery-pod" style={{ left: bedPos.x - 10, top: bedPos.y + 28 }}>
            <span className="scene-recovery-pod__shell" />
            <span className="scene-recovery-pod__core" />
            <span className="scene-recovery-pod__light" />
          </div>
        </Fragment>
      ))}

      <div className="scene-meeting-hub" style={{ left: MEETING_HUB.x, top: MEETING_HUB.y }}>
        <span className="scene-meeting-hub__halo" />
        <span className="scene-meeting-hub__table" />
        <span className="scene-meeting-hub__signal scene-meeting-hub__signal--one" />
        <span className="scene-meeting-hub__signal scene-meeting-hub__signal--two" />
      </div>
    </div>
  );
}
