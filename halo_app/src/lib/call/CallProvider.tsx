import { useQueryClient } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';

import { client } from '@/api/common';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

const DEFAULT_ICE_SERVERS = [
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
  peerMuted: boolean;
  peerCameraOff: boolean;
  callDurationSec: number;
  quality: CallQuality;
  speakerOn: boolean;
  error: string | null;
  startCall: (peerId: string, mode?: CallMode) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  toggleSpeaker: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

async function fetchIceServers() {
  try {
    const res = await client.get<{ data: { iceServers: any[] } }>(
      '/call/ice-servers'
    );
    return res.data?.data?.iceServers ?? DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<CallStatus>('idle');
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [role, setRole] = useState<'caller' | 'callee' | null>(null);
  const [mode, setMode] = useState<CallMode>('video');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [peerCameraOff, setPeerCameraOff] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [quality, setQuality] = useState<CallQuality>('unknown');
  const [speakerOn, setSpeakerOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const peerAcceptedRef = useRef(false);
  const callSessionIdRef = useRef<string | null>(null);
  const incomingOfferRef = useRef<IncomingPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const modeRef = useRef<CallMode>('video');
  const roleRef = useRef<'caller' | 'callee' | null>(null);

  // Timers
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
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    setCallSessionId(null);
    setPeerId(null);
    setRole(null);
    setMode('video');
    setIsMuted(false);
    setIsCameraOff(false);
    setPeerMuted(false);
    setPeerCameraOff(false);
    setCallDurationSec(0);
    setQuality('unknown');
    setSpeakerOn(false);
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

  /* ------------------------------ Helpers ------------------------------ */

  const flushOutgoingIce = useCallback(() => {
    const socket = socketRef.current;
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
        let lossPct: number | undefined;
        let inboundPacketsLost = 0;
        let inboundPacketsReceived = 0;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              rtt = report.currentRoundTripTime * 1000;
            }
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            inboundPacketsLost += report.packetsLost ?? 0;
            inboundPacketsReceived += report.packetsReceived ?? 0;
          }
        });
        if (inboundPacketsReceived > 0) {
          lossPct =
            (inboundPacketsLost / (inboundPacketsLost + inboundPacketsReceived)) *
            100;
        }
        const q: CallQuality =
          rtt === undefined
            ? 'unknown'
            : rtt < 150 && (lossPct ?? 0) < 2
              ? 'good'
              : rtt < 400 && (lossPct ?? 0) < 8
                ? 'fair'
                : 'poor';
        setQuality(q);
      } catch {}
    }, STATS_INTERVAL_MS);
  }, []);

  /* ----------------------------- ICE Restart --------------------------- */

  const tryIceRestart = useCallback(async () => {
    if (iceRestartingRef.current) return;
    const pc = pcRef.current;
    const socket = socketRef.current;
    const sid = callSessionIdRef.current;
    if (!pc || !socket || !sid) return;
    // Only the caller initiates the restart (avoid glare)
    if (roleRef.current !== 'caller') return;
    iceRestartingRef.current = true;
    try {
      console.log('[Call] attempting ICE restart');
      const offer = await pc.createOffer({ iceRestart: true } as any);
      await pc.setLocalDescription(offer);
      socket.emit('call:restart_offer', {
        callSessionId: sid,
        offerSdp: offer.sdp,
      });
    } catch (e: any) {
      console.warn('[Call] ICE restart failed', e?.message);
      iceRestartingRef.current = false;
    }
  }, []);

  const buildPeerConnection = useCallback(
    async (iceServers: any[]) => {
      const pc = new RTCPeerConnection({ iceServers });

      pc.addEventListener('icecandidate', (ev: any) => {
        if (!ev.candidate) return;
        const candidate = ev.candidate.toJSON
          ? ev.candidate.toJSON()
          : ev.candidate;
        if (__DEV__) {
          console.log('[ICE local]', candidate?.candidate);
        }
        const socket = socketRef.current;
        const sid = callSessionIdRef.current;
        if (socket && sid && peerAcceptedRef.current) {
          socket.emit('call:ice', { callSessionId: sid, candidate });
        } else {
          pendingIceRef.current.push(candidate);
        }
      });

      pc.addEventListener('track', (ev: any) => {
        const [stream] = ev.streams;
        if (stream) setRemoteStream(stream);
      });

      pc.addEventListener('connectionstatechange', () => {
        const s = pc.connectionState;
        console.log('[PC state]', s);
        if (s === 'connected') {
          setStatus('active');
          startDurationTimer();
          startStatsPoll();
          iceRestartingRef.current = false;
        } else if (s === 'disconnected') {
          // Wait a bit, then try ICE restart
          setTimeout(() => {
            if (pcRef.current?.connectionState === 'disconnected') {
              tryIceRestart();
            }
          }, 2000);
        } else if (s === 'failed') {
          tryIceRestart();
        }
      });

      pcRef.current = pc;
      return pc;
    },
    [startDurationTimer, startStatsPoll, tryIceRestart]
  );

  /* ------------------------------ Media -------------------------------- */

  const getLocalMedia = useCallback(async (callMode: CallMode) => {
    const wantVideo = callMode === 'video';
    let stream: MediaStream;
    try {
      stream = (await mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? ({ facingMode: 'user' } as any) : false,
      })) as MediaStream;
    } catch (e: any) {
      console.warn('[Call] constraint failed, retrying with defaults', e?.message);
      stream = (await mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo,
      })) as MediaStream;
    }

    const tracks = stream.getTracks();
    console.log(
      '[Call] getUserMedia OK (mode=' + callMode + ') tracks:',
      tracks.map((t: any) => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
      }))
    );

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /* --------------------------- Public actions -------------------------- */

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
        const pc = await buildPeerConnection(iceServers);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        const socket = await getSocket();
        socketRef.current = socket;
        if (!socket) throw new Error('Socket unavailable');
        socket.emit('call:invite', {
          calleeId: targetPeerId,
          offerSdp: offer.sdp,
          mode: callMode,
        });

        // Auto-end if callee doesn't accept within 30s
        if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        ringTimerRef.current = setTimeout(() => {
          if (roleRef.current === 'caller' && !peerAcceptedRef.current) {
            console.log('[Call] outgoing ring timeout — ending');
            const sid = callSessionIdRef.current;
            if (sid && socketRef.current) {
              socketRef.current.emit('call:end', { callSessionId: sid });
            }
            cleanup();
            queryClient.invalidateQueries({ queryKey: ['call-history'] });
          }
        }, RING_TIMEOUT_MS);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to start call');
        cleanup();
      }
    },
    [status, getLocalMedia, buildPeerConnection, cleanup, queryClient]
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
      const pc = await buildPeerConnection(iceServers);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: incoming.offerSdp })
      );
      remoteSetRef.current = true;
      await flushRemoteIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      peerAcceptedRef.current = true;
      callSessionIdRef.current = incoming.callSessionId;

      const socket = await getSocket();
      socketRef.current = socket;
      socket?.emit('call:accept', {
        callSessionId: incoming.callSessionId,
        answerSdp: answer.sdp,
      });
      flushOutgoingIce();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to accept call');
      const socket = await getSocket();
      socket?.emit('call:decline', { callSessionId: incoming.callSessionId });
      cleanup();
    }
  }, [
    status,
    getLocalMedia,
    buildPeerConnection,
    flushRemoteIce,
    flushOutgoingIce,
    cleanup,
  ]);

  const declineIncoming = useCallback(() => {
    const incoming = incomingOfferRef.current;
    if (!incoming) {
      cleanup();
      return;
    }
    getSocket().then((s) =>
      s?.emit('call:decline', { callSessionId: incoming.callSessionId })
    );
    cleanup();
    queryClient.invalidateQueries({ queryKey: ['call-history'] });
  }, [cleanup, queryClient]);

  const endCall = useCallback(() => {
    const sid = callSessionIdRef.current;
    if (sid) {
      getSocket().then((s) => s?.emit('call:end', { callSessionId: sid }));
    }
    cleanup();
    queryClient.invalidateQueries({ queryKey: ['call-history'] });
  }, [cleanup, queryClient]);

  const emitTrackState = useCallback(
    (next: { muted: boolean; cameraOff: boolean }) => {
      const sid = callSessionIdRef.current;
      const socket = socketRef.current;
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

  const switchCamera = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t: any) => {
      if (typeof t._switchCamera === 'function') t._switchCamera();
    });
  }, []);

  /**
   * Best-effort speaker toggle via expo-av audio mode.
   * Reliable routing on iOS requires a dedicated native module
   * (e.g. react-native-incall-manager). On Android, `playThroughEarpieceAndroid`
   * gives correct routing.
   */
  const toggleSpeaker = useCallback(async () => {
    const next = !speakerOn;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !next,
      });
      setSpeakerOn(next);
    } catch (e) {
      console.warn('[Call] toggleSpeaker failed', e);
    }
  }, [speakerOn]);

  /* ------------------------- Socket subscriptions ------------------------- */

  const authToken = useAuth((s) => s.token?.access);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    let socket: Socket | null = null;

    const onRinging = (data: { callSessionId: string; mode?: CallMode }) => {
      console.log('[Call] ringing', data.callSessionId);
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

      // Auto-decline (mark missed) if not answered in 30s
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        console.log('[Call] incoming ring timeout — declining (missed)');
        socketRef.current?.emit('call:decline', {
          callSessionId: data.callSessionId,
        });
        cleanup();
        queryClient.invalidateQueries({ queryKey: ['call-history'] });
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
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp })
        );
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
      console.log('[Call] declined');
      setError('declined');
      cleanup();
    };

    const onEnded = () => {
      console.log('[Call] ended by peer');
      cleanup();
    };

    const onOffline = () => {
      setError('offline');
      cleanup();
    };

    const onBusy = () => {
      setError('busy');
      cleanup();
    };

    const onPeerTrackState = (data: {
      callSessionId: string;
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
      console.log('[Call] restart_offer from peer');
      const pc = pcRef.current;
      const socket = socketRef.current;
      if (!pc || !socket) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: data.offerSdp })
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:restart_answer', {
          callSessionId: data.callSessionId,
          answerSdp: answer.sdp,
        });
      } catch (e: any) {
        console.warn('[Call] restart_offer apply failed', e?.message);
      }
    };

    const onRestartAnswer = async (data: {
      callSessionId: string;
      answerSdp: string;
    }) => {
      console.log('[Call] restart_answer from peer');
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp })
        );
        iceRestartingRef.current = false;
      } catch (e: any) {
        console.warn('[Call] restart_answer apply failed', e?.message);
      }
    };

    const setup = async () => {
      socket = await getSocket();
      if (!socket || !active) return;
      socketRef.current = socket;
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
      console.log('[Call] listeners attached');
    };

    setup();

    return () => {
      active = false;
      if (socket) {
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
      }
    };
  }, [authToken, cleanup, flushOutgoingIce, flushRemoteIce, queryClient]);

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
      peerMuted,
      peerCameraOff,
      callDurationSec,
      quality,
      speakerOn,
      error,
      startCall,
      acceptIncoming,
      declineIncoming,
      endCall,
      toggleMute,
      toggleCamera,
      switchCamera,
      toggleSpeaker,
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
      peerMuted,
      peerCameraOff,
      callDurationSec,
      quality,
      speakerOn,
      error,
      startCall,
      acceptIncoming,
      declineIncoming,
      endCall,
      toggleMute,
      toggleCamera,
      switchCamera,
      toggleSpeaker,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
