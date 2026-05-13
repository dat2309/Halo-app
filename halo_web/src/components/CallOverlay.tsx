import React, { useEffect, useRef } from 'react';

import { useCall } from '../lib/call';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function QualityBars({ quality }: { quality: 'unknown' | 'good' | 'fair' | 'poor' }) {
  const filled = quality === 'good' ? 3 : quality === 'fair' ? 2 : quality === 'poor' ? 1 : 0;
  const color =
    quality === 'good' ? '#22c55e' : quality === 'fair' ? '#facc15' : quality === 'poor' ? '#ef4444' : '#6b7280';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 6 + i * 4,
            borderRadius: 1,
            background: i < filled ? color : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </div>
  );
}

export function CallOverlay() {
  const {
    status,
    mode,
    peerId,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    peerMuted,
    peerCameraOff,
    callDurationSec,
    quality,
    error,
    acceptIncoming,
    declineIncoming,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Attach streams to elements. We render <video>/<audio> elements
  // unconditionally and toggle visibility via CSS — otherwise the ref points
  // to a not-yet-mounted element when the status flips to 'active', and
  // srcObject ends up never set.
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!error) return;
    if (error === 'offline') alert('Peer is offline');
    else if (error === 'busy') alert('Peer is busy');
    else if (error === 'declined') alert('Call declined');
  }, [error]);

  if (status === 'idle') return null;

  const statusLabel: Record<string, string> = {
    outgoing_ringing: 'Calling…',
    incoming_ringing: mode === 'audio' ? 'Incoming voice call' : 'Incoming video call',
    connecting: 'Connecting…',
    active: '',
  };

  const showRemoteVideo =
    mode === 'video' && !!remoteStream && status === 'active' && !peerCameraOff;
  const showLocalSelfView =
    mode === 'video' &&
    status !== 'incoming_ringing' &&
    !!localStream &&
    !isCameraOff;

  return (
    <div className="call-overlay">
      {/* Remote VIDEO — always mounted so srcObject stays attached. */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="remote"
        style={{ display: showRemoteVideo ? 'block' : 'none' }}
      />

      {/* Remote AUDIO — for audio-only mode; always mounted so the stream
          starts playing as soon as it arrives. */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* Placeholder when no remote video is visible */}
      {!showRemoteVideo && (
        <div className="placeholder">
          <div className="big-avatar">{mode === 'audio' ? '📞' : '📹'}</div>
          <div className="status-text">{statusLabel[status]}</div>
          <div className="muted">peer: {peerId?.slice(-6)}</div>
          {status === 'active' && peerCameraOff && (
            <div className="muted small">Camera off</div>
          )}
        </div>
      )}

      {/* Top status bar */}
      {status === 'active' && (
        <div className="call-top-bar">
          <QualityBars quality={quality} />
          <span style={{ color: '#fff', fontWeight: 600 }}>
            {formatDuration(callDurationSec)}
          </span>
          {peerMuted && <span style={{ color: '#ef4444' }}>🔇</span>}
        </div>
      )}

      {/* Local self-view — always mounted, visibility toggled via display */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="local"
        style={{ display: showLocalSelfView ? 'block' : 'none' }}
      />

      <div className="call-controls">
        {status === 'incoming_ringing' ? (
          <>
            <button className="btn-red" onClick={declineIncoming}>
              ✕ Decline
            </button>
            <button className="btn-green" onClick={acceptIncoming}>
              {mode === 'audio' ? '📞 Accept' : '📹 Accept'}
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute}>
              {isMuted ? '🔇 Unmute' : '🎙 Mute'}
            </button>
            {mode === 'video' && (
              <button onClick={toggleCamera}>
                {isCameraOff ? '📷 Camera on' : '🎥 Camera off'}
              </button>
            )}
            <button className="btn-red" onClick={endCall}>
              ✕ End
            </button>
          </>
        )}
      </div>
    </div>
  );
}
