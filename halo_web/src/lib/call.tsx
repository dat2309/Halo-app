import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api } from './api';
import { useAuth } from './auth';
import { getSocket } from './socket';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const RING_TIMEOUT_MS = 30_000;
const STATS_INTERVAL_MS = 3_000;

export type CallStatus =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'active';

export type CallMode = 'audio' | 'video';
export type CallQuality = 'unknown' | 'good' | 'fair' | 'poor';

type IncomingPayload = {
  callSessionId: string;
  callerId: string;
  offerSdp: string;
  mode?: CallMode;
};

type CallContextValue = {
  status: CallStatus;
  callSessionId: string | null;
  peerId: string | null;
  role: 'caller' | 'callee' | null;
  mode: CallMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSharingScreen: boolean;
  peerMuted: boolean;
  peerCameraOff: boolean;
  callDurationSec: number;
  quality: CallQuality;
  error: string | null;
  startCall: (peerId: string, mode?: CallMode) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await api.get('/call/ice-servers');
    return res.data?.data?.iceServers ?? DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [role, setRole] = useState<'caller' | 'callee' | null>(null);
  const [mode, setMode] = useState<CallMode>('video');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [peerCameraOff, setPeerCameraOff] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [quality, setQuality] = useState<CallQuality>('unknown');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const peerAcceptedRef = useRef(false);
  const callSessionIdRef = useRef<string | null>(null);
  const incomingOfferRef = useRef<IncomingPayload | null>(null);
  const modeRef = useRef<CallMode>('video');
  const roleRef = useRef<'caller' | 'callee' | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceRestartingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;
    cameraVideoTrackRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    setCallSessionId(null);
    setPeerId(null);
    setRole(null);
    setMode('video');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSharingScreen(false);
    setPeerMuted(false);
    setPeerCameraOff(false);
    setCallDurationSec(0);
    setQuality('unknown');
    pendingIceRef.current = [];
    pendingRemoteIceRef.current = [];
    remoteSetRef.current = false;
    peerAcceptedRef.current = false;
    callSessionIdRef.current = null;
    incomingOfferRef.current = null;
    modeRef.current = 'video';
    roleRef.current = null;
    iceRestartingRef.current = false;
  }, [clearTimers]);

  const flushOutgoingIce = useCallback(() => {
    const socket = getSocket();
    const sid = callSessionIdRef.current;
    if (!socket || !sid || !peerAcceptedRef.current) return;
    while (pendingIceRef.current.length) {
      const candidate = pendingIceRef.current.shift();
      socket.emit('call:ice', { callSessionId: sid, candidate });
    }
  }, []);

  const flushRemoteIce = useCallback(async () => {
    if (!pcRef.current || !remoteSetRef.current) return;
    while (pendingRemoteIceRef.current.length) {
      const c = pendingRemoteIceRef.current.shift();
      if (c) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;
    const startedAt = Date.now();
    durationTimerRef.current = setInterval(() => {
      setCallDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }, []);

  const startStatsPoll = useCallback(() => {
    if (statsTimerRef.current) return;
    statsTimerRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt: number | undefined;
        let lost = 0;
        let received = 0;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number')
              rtt = report.currentRoundTripTime * 1000;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            lost += report.packetsLost ?? 0;
            received += report.packetsReceived ?? 0;
          }
        });
        const lossPct = received > 0 ? (lost / (lost + received)) * 100 : 0;
        const q: CallQuality =
          rtt === undefined
            ? 'unknown'
            : rtt < 150 && lossPct < 2
              ? 'good'
              : rtt < 400 && lossPct < 8
                ? 'fair'
                : 'poor';
        setQuality(q);
      } catch {}
    }, STATS_INTERVAL_MS);
  }, []);

  const tryIceRestart = useCallback(async () => {
    if (iceRestartingRef.current) return;
    const pc = pcRef.current;
    const socket = getSocket();
    const sid = callSessionIdRef.current;
    if (!pc || !socket || !sid) return;
    if (roleRef.current !== 'caller') return;
    iceRestartingRef.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socket.emit('call:restart_offer', {
        callSessionId: sid,
        offerSdp: offer.sdp,
      });
    } catch {
      iceRestartingRef.current = false;
    }
  }, []);

  const buildPeerConnection = useCallback((iceServers: RTCIceServer[]) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const candidate = ev.candidate.toJSON();
      console.log('[ICE local]', candidate.candidate);
      const socket = getSocket();
      const sid = callSessionIdRef.current;
      if (socket && sid && peerAcceptedRef.current) {
        socket.emit('call:ice', { callSessionId: sid, candidate });
      } else {
        pendingIceRef.current.push(candidate);
      }
    };

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log('[PC state]', s);
      if (s === 'connected') {
        setStatus('active');
        startDurationTimer();
        startStatsPoll();
        iceRestartingRef.current = false;
      } else if (s === 'disconnected') {
        setTimeout(() => {
          if (pcRef.current?.connectionState === 'disconnected') {
            tryIceRestart();
          }
        }, 2000);
      } else if (s === 'failed') {
        tryIceRestart();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [startDurationTimer, startStatsPoll, tryIceRestart]);

  const getLocalMedia = useCallback(async (callMode: CallMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callMode === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(
    async (targetPeerId: string, callMode: CallMode = 'video') => {
      if (status !== 'idle') return;
      setError(null);
      setRole('caller');
      roleRef.current = 'caller';
      setPeerId(targetPeerId);
      setMode(callMode);
      modeRef.current = callMode;
      setStatus('outgoing_ringing');

      try {
        const iceServers = await fetchIceServers();
        const stream = await getLocalMedia(callMode);
        const pc = buildPeerConnection(iceServers);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        // Cache camera track ref so we can swap back from screen share
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) cameraVideoTrackRef.current = vTrack;

        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        const socket = getSocket();
        if (!socket) throw new Error('Socket unavailable');
        socket.emit('call:invite', {
          calleeId: targetPeerId,
          offerSdp: offer.sdp,
          mode: callMode,
        });

        if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        ringTimerRef.current = setTimeout(() => {
          if (roleRef.current === 'caller' && !peerAcceptedRef.current) {
            const sid = callSessionIdRef.current;
            if (sid) {
              getSocket()?.emit('call:end', { callSessionId: sid });
            }
            cleanup();
          }
        }, RING_TIMEOUT_MS);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to start call');
        cleanup();
      }
    },
    [status, getLocalMedia, buildPeerConnection, cleanup]
  );

  const acceptIncoming = useCallback(async () => {
    if (status !== 'incoming_ringing') return;
    const incoming = incomingOfferRef.current;
    if (!incoming) return;
    setStatus('connecting');
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }

    try {
      const iceServers = await fetchIceServers();
      const stream = await getLocalMedia(modeRef.current);
      const pc = buildPeerConnection(iceServers);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) cameraVideoTrackRef.current = vTrack;

      await pc.setRemoteDescription({ type: 'offer', sdp: incoming.offerSdp });
      remoteSetRef.current = true;
      await flushRemoteIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      peerAcceptedRef.current = true;
      callSessionIdRef.current = incoming.callSessionId;

      getSocket()?.emit('call:accept', {
        callSessionId: incoming.callSessionId,
        answerSdp: answer.sdp,
      });
      flushOutgoingIce();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to accept call');
      getSocket()?.emit('call:decline', {
        callSessionId: incoming.callSessionId,
      });
      cleanup();
    }
  }, [status, getLocalMedia, buildPeerConnection, flushRemoteIce, flushOutgoingIce, cleanup]);

  const declineIncoming = useCallback(() => {
    const incoming = incomingOfferRef.current;
    if (incoming) {
      getSocket()?.emit('call:decline', {
        callSessionId: incoming.callSessionId,
      });
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(() => {
    const sid = callSessionIdRef.current;
    if (sid) getSocket()?.emit('call:end', { callSessionId: sid });
    cleanup();
  }, [cleanup]);

  const emitTrackState = useCallback(
    (next: { muted: boolean; cameraOff: boolean }) => {
      const sid = callSessionIdRef.current;
      const socket = getSocket();
      if (!sid || !socket) return;
      socket.emit('call:track_state', { callSessionId: sid, ...next });
    },
    []
  );

  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const newMuted = !isMuted;
    s.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    setIsMuted(newMuted);
    emitTrackState({ muted: newMuted, cameraOff: isCameraOff });
  }, [isMuted, isCameraOff, emitTrackState]);

  const toggleCamera = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const newOff = !isCameraOff;
    s.getVideoTracks().forEach((t) => (t.enabled = !newOff));
    setIsCameraOff(newOff);
    emitTrackState({ muted: isMuted, cameraOff: newOff });
  }, [isCameraOff, isMuted, emitTrackState]);

  /**
   * Replace the outgoing video track with a screen capture (getDisplayMedia).
   * On "Stop sharing" from browser UI, the track emits `ended` → restore camera.
   */
  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const videoSender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');
    if (!videoSender) return;

    if (!isSharingScreen) {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = screen as MediaStream;
        const screenTrack = (screen as MediaStream).getVideoTracks()[0];
        if (!screenTrack) return;
        await videoSender.replaceTrack(screenTrack);
        setIsSharingScreen(true);
        screenTrack.onended = async () => {
          // User stopped sharing via browser UI
          const cam = cameraVideoTrackRef.current;
          if (cam) await videoSender.replaceTrack(cam);
          setIsSharingScreen(false);
          screenStreamRef.current = null;
        };
      } catch (e: any) {
        console.warn('[Call] screen share canceled/failed', e?.message);
      }
    } else {
      const cam = cameraVideoTrackRef.current;
      if (cam) await videoSender.replaceTrack(cam);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsSharingScreen(false);
    }
  }, [isSharingScreen]);

  /* Socket subscriptions */
  const { token } = useAuth();

  useEffect(() => {
    if (!token?.access) return;
    const socket = getSocket();
    if (!socket) return;

    const onRinging = (data: { callSessionId: string; mode?: CallMode }) => {
      callSessionIdRef.current = data.callSessionId;
      setCallSessionId(data.callSessionId);
      if (data.mode) {
        modeRef.current = data.mode;
        setMode(data.mode);
      }
    };

    const onIncoming = (data: IncomingPayload) => {
      console.log('[Call] incoming from', data.callerId);
      if (pcRef.current) return;
      const m: CallMode = data.mode === 'audio' ? 'audio' : 'video';
      incomingOfferRef.current = data;
      callSessionIdRef.current = data.callSessionId;
      setCallSessionId(data.callSessionId);
      setRole('callee');
      roleRef.current = 'callee';
      setPeerId(data.callerId);
      setMode(m);
      modeRef.current = m;
      setStatus('incoming_ringing');

      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        getSocket()?.emit('call:decline', {
          callSessionId: data.callSessionId,
        });
        cleanup();
      }, RING_TIMEOUT_MS);
    };

    const onAccepted = async (data: {
      callSessionId: string;
      answerSdp: string;
    }) => {
      console.log('[Call] accepted', data.callSessionId);
      if (ringTimerRef.current) {
        clearTimeout(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription({
          type: 'answer',
          sdp: data.answerSdp,
        });
        remoteSetRef.current = true;
        peerAcceptedRef.current = true;
        await flushRemoteIce();
        flushOutgoingIce();
        setStatus('connecting');
      } catch (e: any) {
        setError(e?.message ?? 'Failed to apply answer');
        cleanup();
      }
    };

    const onIce = async (data: { candidate: RTCIceCandidateInit }) => {
      if (!pcRef.current || !data?.candidate) return;
      if (!remoteSetRef.current) {
        pendingRemoteIceRef.current.push(data.candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {}
    };

    const onDeclined = () => {
      setError('declined');
      cleanup();
    };
    const onEnded = () => cleanup();
    const onOffline = () => {
      setError('offline');
      cleanup();
    };
    const onBusy = () => {
      setError('busy');
      cleanup();
    };
    const onPeerTrackState = (data: {
      muted: boolean;
      cameraOff: boolean;
    }) => {
      setPeerMuted(!!data.muted);
      setPeerCameraOff(!!data.cameraOff);
    };
    const onRestartOffer = async (data: {
      callSessionId: string;
      offerSdp: string;
    }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.offerSdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit('call:restart_answer', {
          callSessionId: data.callSessionId,
          answerSdp: answer.sdp,
        });
      } catch (e) {
        console.warn('[Call] restart_offer apply failed', e);
      }
    };
    const onRestartAnswer = async (data: { answerSdp: string }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: data.answerSdp,
        });
        iceRestartingRef.current = false;
      } catch {}
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:ice', onIce);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);
    socket.on('call:offline', onOffline);
    socket.on('call:busy', onBusy);
    socket.on('call:track_state', onPeerTrackState);
    socket.on('call:restart_offer', onRestartOffer);
    socket.on('call:restart_answer', onRestartAnswer);
    console.log('[Call] listeners attached for user');

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:ice', onIce);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
      socket.off('call:offline', onOffline);
      socket.off('call:busy', onBusy);
      socket.off('call:track_state', onPeerTrackState);
      socket.off('call:restart_offer', onRestartOffer);
      socket.off('call:restart_answer', onRestartAnswer);
    };
  }, [token?.access, cleanup, flushOutgoingIce, flushRemoteIce]);

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      callSessionId,
      peerId,
      role,
      mode,
      localStream,
      remoteStream,
      isMuted,
      isCameraOff,
      isSharingScreen,
      peerMuted,
      peerCameraOff,
      callDurationSec,
      quality,
      error,
      startCall,
      acceptIncoming,
      declineIncoming,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
    }),
    [
      status,
      callSessionId,
      peerId,
      role,
      mode,
      localStream,
      remoteStream,
      isMuted,
      isCameraOff,
      isSharingScreen,
      peerMuted,
      peerCameraOff,
      callDurationSec,
      quality,
      error,
      startCall,
      acceptIncoming,
      declineIncoming,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
