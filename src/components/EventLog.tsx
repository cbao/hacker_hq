import useStore from '../store';
import { EVENT_COLORS } from '../dashboardTheme';
import '../styles/EventLog.css';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export default function EventLog() {
  const eventLog = useStore((s) => s.eventLog);

  return (
    <div className="event-log">
      {eventLog.map((e, i) => (
        <div className="log-row" key={`${e.id}-${e.ts}-${i}`}>
          <span className="log-ts">{formatTime(e.ts)}</span>
          <span className="log-name">{e.name}</span>
          <span
            className="log-dot"
            style={{ background: EVENT_COLORS[e.event] ?? '#6b7f70' }}
          />
          <span
            className="log-event"
            style={{ color: EVENT_COLORS[e.event] ?? '#6b7f70' }}
          >
            {e.event.replace(/_/g, ' ')}
          </span>
          <span className="log-summary">{e.summary}</span>
        </div>
      ))}
    </div>
  );
}
