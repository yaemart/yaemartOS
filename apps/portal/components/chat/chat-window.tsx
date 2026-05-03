'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatStreamUrl,
  createOrResumeChatSession,
  sendChatMessage,
} from '../../lib/api/customer-api-client';
import { MessageBubble } from './message-bubble';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface ChatWindowProps {
  locale: string;
  accessToken?: string;
  brand?: string;
  /** Brand display name shown in the welcome message. Defaults to the brand slug capitalized. */
  brandDisplayName?: string;
  /** Suggested prompt chips shown before the first message. */
  suggestedPrompts?: string[];
}

const DEFAULT_SUGGESTED_PROMPTS = [
  'Where is my order?',
  'How do I register my warranty?',
  'What is your return policy?',
];

export function ChatWindow({
  locale,
  accessToken,
  brand,
  brandDisplayName,
  suggestedPrompts = DEFAULT_SUGGESTED_PROMPTS,
}: ChatWindowProps) {
  const displayName =
    brandDisplayName ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Support');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('chat_session_token') ?? undefined;
    createOrResumeChatSession(storedToken, accessToken)
      .then(({ sessionId: id, sessionToken: token }) => {
        setSessionId(id);
        sessionStorage.setItem('chat_session_token', token);
      })
      .catch(() => setError('Unable to start chat. Please try again.'));
  }, [accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openStream = useCallback((id: string) => {
    if (esRef.current) {
      esRef.current.close();
    }
    const url = `${chatStreamUrl(id)}?brand=${brand ?? process.env.NEXT_PUBLIC_BRAND ?? 'homtone'}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as {
        token?: string;
        done?: boolean;
        escalated?: boolean;
      };

      if (data.token) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            return prev.slice(0, -1).concat({
              ...last,
              content: last.content + data.token!,
            });
          }
          return prev.concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.token!,
            streaming: true,
          });
        });
      }

      if (data.done || data.escalated) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            return prev.slice(0, -1).concat({ ...last, streaming: false });
          }
          return prev;
        });
        setIsStreaming(false);
        if (data.escalated) {
          setIsEscalated(true);
        }
        es.close();
      }
    };

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
    };
  }, []);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || !sessionId || isStreaming) {
      return;
    }

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
    setIsStreaming(true);

    openStream(sessionId);

    try {
      await sendChatMessage(sessionId, content, locale, accessToken);
    } catch {
      setError('Failed to send message. Please try again.');
      setIsStreaming(false);
    }
  }, [input, sessionId, isStreaming, locale, accessToken, openStream]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div
      className="flex flex-col h-full max-w-2xl mx-auto"
      data-brand={brand ?? process.env.NEXT_PUBLIC_BRAND}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="text-center">
              <p className="font-medium text-sm" style={{ color: 'var(--color-text, #111827)' }}>
                Hi! I&apos;m the {displayName} support assistant.
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-muted, #9ca3af)' }}>
                I can help with orders, products, warranty, and returns.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 w-full">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                  }}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{
                    borderColor: 'var(--color-primary, #3b82f6)',
                    color: 'var(--color-primary, #3b82f6)',
                    backgroundColor: 'transparent',
                  }}
                  disabled={isStreaming || isEscalated || !sessionId}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isEscalated && (
          <div
            className="rounded-lg p-3 text-sm border"
            style={{
              backgroundColor: 'var(--color-warning-bg, #fffbeb)',
              borderColor: 'var(--color-warning-border, #fcd34d)',
              color: 'var(--color-warning-text, #92400e)',
            }}
          >
            Your conversation has been escalated to our support team. A ticket has been created.
          </div>
        )}
        {error && (
          <p className="text-center text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-4" style={{ backgroundColor: 'var(--color-surface, #ffffff)' }}>
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border, #d1d5db)',
              outlineColor: 'var(--color-primary, #3b82f6)',
            }}
            rows={2}
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isEscalated || !sessionId}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isStreaming || isEscalated || !sessionId}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary, #3b82f6)',
              color: 'var(--color-primary-fg, #ffffff)',
            }}
          >
            {isStreaming ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
