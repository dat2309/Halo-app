import React, { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

export type Participant = {
  _id: string;
  name?: string;
  username?: string;
  avatar?: string;
};

export type Conversation = {
  _id: string;
  participants: Participant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

function peerOf(c: Conversation, meId?: string): Participant {
  const list = (c.participants ?? []).map((p: any) =>
    typeof p === 'string' ? { _id: p } : p
  );
  const peer = meId
    ? list.find((p) => String(p._id) !== String(meId))
    : list[1];
  return peer ?? list[0] ?? { _id: '?' };
}

function displayName(p: Participant): string {
  const n = (p.name ?? '').trim();
  if (n) return n;
  const u = (p.username ?? '').trim();
  if (u) return `@${u}`;
  return `User ${String(p._id ?? '').slice(-4)}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type Props = {
  meId?: string;
  selectedId: string | null;
  onSelect: (id: string, peerId: string) => void;
};

export function ConversationList({ meId, selectedId, onSelect }: Props) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setItems(res.data?.data ?? []);
    } catch (e) {
      console.warn('Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    const socket = getSocket();
    if (!socket) return;
    const handler = () => refetch();
    socket.on('chat:message', handler);
    socket.on('chat:conversation_updated', handler);
    socket.on('chat:read', handler);
    return () => {
      socket.off('chat:message', handler);
      socket.off('chat:conversation_updated', handler);
      socket.off('chat:read', handler);
    };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Conversations</div>
      {loading ? (
        <div className="muted center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="muted center">No conversations yet</div>
      ) : (
        <ul className="conv-list">
          {items.map((c) => {
            const peer = peerOf(c, meId);
            const isSelected = c._id === selectedId;
            const unread = c.unreadCount ?? 0;
            return (
              <li
                key={c._id}
                className={`conv-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(c._id, peer._id)}
              >
                <div className="avatar">
                  {(peer.name?.[0] ?? peer.username?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="conv-body">
                  <div className="conv-top">
                    <strong className={unread ? 'unread' : ''}>
                      {displayName(peer)}
                    </strong>
                    <span className="muted small">
                      {timeAgo(c.lastMessageAt)}
                    </span>
                  </div>
                  <div className="conv-bottom">
                    <span
                      className={`preview ${unread ? 'unread' : 'muted'}`}
                    >
                      {c.lastMessage ?? 'Say hi 👋'}
                    </span>
                    {unread > 0 && <span className="badge">{unread}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
