export default function MessageBubble({ text, isSent, eventType }: { text: string; isSent: boolean; eventType: string }) {
  return (
    <div
      className={`msg-bubble ${isSent ? 'msg-sent' : 'msg-received'}`}
      data-event={eventType}
    >
      {text}
    </div>
  );
}
