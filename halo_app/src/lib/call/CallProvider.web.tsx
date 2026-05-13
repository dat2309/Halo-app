import React, { createContext, useContext, useMemo } from 'react';

/**
 * Web stub for CallProvider.
 *
 * react-native-webrtc has no web binding. The web app falls back to a no-op
 * provider so screens that import `useCall()` don't crash. Video call entry
 * points (e.g. the video icon in chat header) should be hidden on web by
 * checking `Platform.OS === 'web'` upstream.
 */

export type CallStatus =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'active';

type CallContextValue = {
  status: CallStatus;
  callSessionId: string | null;
  peerId: string | null;
  role: 'caller' | 'callee' | null;
  localStream: null;
  remoteStream: null;
  isMuted: boolean;
  isCameraOff: boolean;
  error: string | null;
  startCall: (peerId: string) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
};

const noop = () => {};
const asyncNoop = async () => {};

const stub: CallContextValue = {
  status: 'idle',
  callSessionId: null,
  peerId: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  error: null,
  startCall: asyncNoop,
  acceptIncoming: asyncNoop,
  declineIncoming: noop,
  endCall: noop,
  toggleMute: noop,
  toggleCamera: noop,
  switchCamera: noop,
};

const CallContext = createContext<CallContextValue>(stub);

export function useCall() {
  return useContext(CallContext);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => stub, []);
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
