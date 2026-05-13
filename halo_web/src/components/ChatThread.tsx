import React, { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { useCall } from '../lib/call';
import { getSocket } from '../lib/socket';

type Message = {
  _id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  createdAt: string;
};

type Props = {
  conversationId: string;
  peerId: string;
  meId?: string;
};

export function ChatThread({ conversationId, peerId, meId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingEmittedRef = useRef(false);

  const { startCall } = useCall();

  const scrollToBottom = () => {
    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  };

  // Initial load
  useEffect(() => {
    setMessages([]);
    api
      .get(`/chat/conversations/${conversationId}/messages`, {
        params: { limit: 50 },
      })
      .then((res) => {
        const list: Message[] = res.data?.data?.list ?? [];
        // Backend returns newest-first; reverse for chronological view
        setMessages([...list].reverse());
        scrollToBottom();
      })
      .catch((e) => console.warn('Failed to load messages', e));

    // Mark read
    api.post(`/chat/conversations/${conversationId}/read`).catch(() => {});
    getSocket()?.emit('chat:read', { conversationId });
  }, [conversationId]);

  // Socket subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (msg: Message) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]
      );
      scrollToBottom();
      if (msg.senderId !== meId) {
        socket.emit('chat:read', { conversationId });
      }
    };
    const onTyping = (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId !== conversationId) return;
      if (data.userId === meId) return;
      setPeerTyping(data.isTyping);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [conversationId, meId]);

  const emitTyping = (isTyping: boolean) => {
    getSocket()?.emit('chat:typing', { conversationId, isTyping });
  };

  const onChangeDraft = (v: string) => {
    setDraft(v);
    if (!isTypingEmittedRef.current && v.length > 0) {
      isTypingEmittedRef.current = true;
      emitTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingEmittedRef.current = false;
      emitTyping(false);
    }, 1500);
  };

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTypingEmittedRef.current) {
      isTypingEmittedRef.current = false;
      emitTyping(false);
    }
    getSocket()?.emit('chat:send', {
      conversationId,
      type: 'text',
      content,
    });
  };

  const parseCallSummary = (content?: string) => {
    if (!content?.startsWith('__call__')) return null;
    try {
      return JSON.parse(content.slice('__call__'.length)) as {
        kind: 'call';
        mode: 'audio' | 'video';
        reason: 'ended' | 'declined' | 'aborted' | 'missed';
        durationSec: number;
        callerId: string;
        calleeId: string;
      };
    } catch {
      return null;
    }
  };

  return (
    <main className="thread">
      <div className="thread-header">
        <div>Conversation</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="call-btn"
            onClick={() => peerId && startCall(peerId, 'audio')}
            disabled={!peerId}
            title="Voice call"
            style={{ background: '#16a34a' }}
          >
            📞
          </button>
          <button
            className="call-btn"
            onClick={() => peerId && startCall(peerId, 'video')}
            disabled={!peerId}
            title="Video call"
          >
            📹
          </button>
        </div>
      </div>

      <div className="messages" ref={listRef}>
        {messages.map((m) => {
          const mine = m.senderId === meId;
          const summary = parseCallSummary(m.content);
          if (summary) {
            const missed = summary.reason === 'missed';
            const declined = summary.reason === 'declined';
            const completed = summary.reason === 'ended';
            const dangerous = missed || declined;
            const label = missed
              ? mine ? 'Missed outgoing call' : 'Missed call'
              : declined
                ? mine ? 'Declined' : 'You declined'
                : summary.reason === 'aborted'
                  ? 'Disconnected'
                  : mine ? 'Outgoing call' : 'Incoming call';
            const dur = completed
              ? ` · ${Math.floor(summary.durationSec / 60)}:${String(summary.durationSec % 60).padStart(2, '0')}`
              : '';
            // Render as a regular message bubble — caller's bubble appears on
            // the right (mine), the other side sees it on the left (theirs).
            return (
              <div key={m._id} className={`msg ${mine ? 'mine' : 'theirs'}`}>
                <div
                  className="bubble"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: dangerous ? 600 : 400,
                    color: dangerous ? '#ef4444' : undefined,
                  }}
                >
                  <span>{summary.mode === 'audio' ? '📞' : '📹'}</span>
                  <span>{label}{dur}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={m._id} className={`msg ${mine ? 'mine' : 'theirs'}`}>
              <div className="bubble">{m.content}</div>
            </div>
          );
        })}
        {peerTyping && (
          <div className="msg theirs">
            <div className="bubble typing">Typing…</div>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={send}>
        <input
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          placeholder="Type a message…"
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
