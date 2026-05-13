import React, { useState } from 'react';

import { ChatThread } from '../components/ChatThread';
import { ConversationList } from '../components/ConversationList';
import { useAuth } from '../lib/auth';

export function ChatPage() {
  const { me, logout } = useAuth();
  const [selected, setSelected] = useState<{
    conversationId: string;
    peerId: string;
  } | null>(null);

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <strong>Halo Web</strong>
          <span className="muted small" style={{ marginLeft: 8 }}>
            {me ? `Signed in as ${me.name ?? me.username ?? me.email}` : ''}
          </span>
        </div>
        <button onClick={logout}>Sign out</button>
      </header>

      <div className="layout-body">
        <ConversationList
          meId={me?._id}
          selectedId={selected?.conversationId ?? null}
          onSelect={(conversationId, peerId) =>
            setSelected({ conversationId, peerId })
          }
        />
        {selected ? (
          <ChatThread
            key={selected.conversationId}
            conversationId={selected.conversationId}
            peerId={selected.peerId}
            meId={me?._id}
          />
        ) : (
          <main className="thread empty">
            <div className="muted center">
              Select a conversation to start chatting
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
