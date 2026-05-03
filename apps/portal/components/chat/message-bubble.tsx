import type { ChatMessage } from './chat-window';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const bubbleStyle = isUser
    ? {
        backgroundColor: 'var(--color-primary, #2563eb)',
        color: 'var(--color-primary-fg, #ffffff)',
      }
    : {
        backgroundColor: 'var(--color-surface-alt, #f3f4f6)',
        color: 'var(--color-text, #1f2937)',
      };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={bubbleStyle}
      >
        {message.content}
        {message.streaming && <span className="inline-block ml-1 animate-pulse">▍</span>}
      </div>
    </div>
  );
}
