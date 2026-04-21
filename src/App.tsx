import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import useStore from './store';
import Scene from './components/Scene';
import IMessageWall from './components/IMessageWall';
import EventLog from './components/EventLog';
import './styles/App.css';

const VIEW_OPTIONS = [
  { id: 'scene', label: 'Scene' },
  { id: 'messages', label: 'Messages' },
] as const;

function formatClock(now: Date): string {
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function MonitorSigil() {
  return (
    <svg className="app-sigil" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M8 6h16l4 4v10l-4 4h-3v4h-2v-2h-2v2h-2v-4h-3l-4-4V10l4-4Zm4 7v4h3v-4h-3Zm5 0v4h3v-4h-3Zm-3 7h6v2h-6v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function App() {
  const agents = useStore((s) => s.agents);
  const connected = useStore((s) => s.connected);
  const navigate = useNavigate();
  const location = useLocation();
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const agentIds = Object.keys(agents);
  const viewName = location.pathname.slice(1) || 'scene';
  const showLog = ['/scene', '/messages'].includes(location.pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = 'legacy';
  }, []);

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <div className="app-shell">
        <header className="app-header">
          <div className="app-brand">
            <h1 className="app-title">HACKER_HQ</h1>
            <span className="app-slash">//</span>
            <nav className="app-nav" aria-label="Primary">
              {VIEW_OPTIONS.map((view) => (
                <button
                  key={view.id}
                  className={`app-nav-button${location.pathname === '/' + view.id ? ' is-active' : ''}`}
                  onClick={() => navigate('/' + view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="app-status">
            <span className="app-status-chip">{agentIds.length.toString().padStart(2, '0')} agents</span>
            <span className={`app-status-chip${connected ? ' is-live' : ' is-offline'}`}>
              {connected ? 'live signal' : 'offline'}
            </span>
<span className="app-clock">{clock}</span>
            <MonitorSigil />
          </div>
        </header>

        <div className="app-divider" />

        <main className={`app-main app-main--${viewName}`}>
          <Routes>
            <Route path="/scene" element={<Scene />} />
            <Route path="/messages" element={<IMessageWall />} />
            <Route path="*" element={<Navigate to="/scene" replace />} />
          </Routes>
        </main>

        {showLog ? (
          <>
            <div className="app-divider" />
            <div className="app-console-shell">
              <div className="app-console-header">
                <span>Transmission Log</span>
                <span>{connected ? 'stream active' : 'waiting for relay'}</span>
              </div>
              <EventLog />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
