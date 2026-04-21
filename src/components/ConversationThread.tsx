import { useRef, useEffect } from 'react';
import type { Message } from '../utils/deriveConversations';
import MessageBubble from './MessageBubble';

interface ConversationThreadProps {
  messages: Message[];
  ownerId: string;
  partnerSprite?: 'cooking' | 'sleeping' | 'error';
}

export default function ConversationThread({ messages, ownerId, partnerSprite }: ConversationThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="convo-thread" ref={containerRef}>
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const showTimestamp = !prev || msg.ts - prev.ts > 60000;
        return (
          <div key={`${msg.ts}-${msg.senderId}-${i}`}>
            {showTimestamp && (
              <div className="msg-timestamp">
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <MessageBubble
              text={msg.text}
              isSent={msg.senderId === ownerId}
              eventType={msg.eventType}
            />
          </div>
        );
      })}
      {partnerSprite === 'cooking' && (
        <div className="typing-indicator">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}
    </div>
  );
}
