import { useRef, useState, useEffect } from 'react';
import useStore from '../store';
import SceneAgent from './SceneAgent';
import SceneBackground from '../sprites/SceneBackground';
import '../styles/Scene.css';

const SCENE_W = 1200;
const SCENE_H = 540;

export default function Scene() {
  const agents = useStore((s) => s.agents);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? SCENE_W;
      setScale(Math.min(1, width / SCENE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="view-shell scene-view">
      <div className="dashboard-surface scene-stage">
        <div className="section-header">
          <div>
            <h2 className="section-title">Scene Relay</h2>
            <p className="section-caption">
              Live office view of active agents, meetings, and workstation state.
            </p>
          </div>
          <span className="section-pill">{Object.keys(agents).length} tracked avatars</span>
        </div>

        <div className="scene-stage-body">
          <div ref={wrapperRef} className="scene-wrapper" style={{ height: SCENE_H * scale }}>
            <div className="scene" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <SceneBackground />
              {Object.keys(agents).map((id) => (
                <SceneAgent key={id} agentId={id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
