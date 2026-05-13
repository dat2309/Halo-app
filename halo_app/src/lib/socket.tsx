import { io, type Socket } from 'socket.io-client';
import { Env } from '@env';
import { getToken } from './auth/utils';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket | null> {
  const tokens = await getToken();
  if (!tokens) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (!socket) {
    const socketUrl = Env.API_URL.replace(/\/api$/, '');
    console.log('[Socket] Initializing with URL:', socketUrl);

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token: tokens.access },
    });

    socket.connect();

    socket.on('connect', () => {
      console.log('[Socket] Connected to server:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      // If auth error, reset socket so next getSocket() creates fresh connection
      if (error.message?.includes('unauthorized') || error.message?.includes('jwt')) {
        socket?.disconnect();
        socket = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us, reset socket
        socket = null;
      }
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}


