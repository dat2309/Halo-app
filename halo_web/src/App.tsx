import React from 'react';

import { CallOverlay } from './components/CallOverlay';
import { AuthProvider, useAuth } from './lib/auth';
import { CallProvider } from './lib/call';
import { ChatPage } from './pages/Chat';
import { LoginPage } from './pages/Login';

function Gate() {
  const { token } = useAuth();
  return token ? <ChatPage /> : <LoginPage />;
}

export function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <Gate />
        <CallOverlay />
      </CallProvider>
    </AuthProvider>
  );
}
