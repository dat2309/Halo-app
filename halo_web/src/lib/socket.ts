import { io, type Socket } from 'socket.io-client';

import { API_URL, getStoredToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = getStoredToken();
  if (!token?.access) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (socket && socket.connected) return socket;
  if (socket) return socket;

  const url = API_URL.replace(/\/api$/, '');
  socket = io(url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    auth: { token: token.access },
  });

  socket.on('connect', () => console.log('[Socket] connected', socket?.id));
  socket.on('connect_error', (e) =>
    console.warn('[Socket] connect_error', e.message)
  );
  socket.on('disconnect', (reason) =>
    console.log('[Socket] disconnect', reason)
  );

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
