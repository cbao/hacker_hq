import type { BubbleEntry } from '../store';
import '../styles/ChatBubble.css';

const GHOST_CLASS = ['bubble-active bubble-fade', 'bubble-ghost-1', 'bubble-ghost-2'];

export default function ChatBubble({ bubbleHistory, align, spriteState }: { bubbleHistory: BubbleEntry[]; align?: 'left' | 'right'; spriteState?: 'cooking' | 'sleeping' | 'error' }) {
  if (bubbleHistory.length === 0) return null;

  const alignClass = align ? ` align-${align}` : '';

  return (
    <div className={`bubble-container${alignClass}`} data-state={spriteState}>
      {bubbleHistory.slice(0, 3).map((entry, i) => (
        <div key={entry.id} className={`bubble ${GHOST_CLASS[i]}`} title={entry.text}>
          {entry.text.length > 60 ? entry.text.slice(0, 60) + '...' : entry.text}
        </div>
      ))}
    </div>
  );
}
