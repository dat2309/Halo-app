import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Vibration } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { usePublicProfile } from '@/api';
import { Text, View } from '@/components/ui';
import { translate, useCall } from '@/lib';

const VIBRATION_PATTERN = [0, 800, 600, 800, 600];

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function QualityBars({
  quality,
}: {
  quality: 'unknown' | 'good' | 'fair' | 'poor';
}) {
  const filled = quality === 'good' ? 3 : quality === 'fair' ? 2 : quality === 'poor' ? 1 : 0;
  const color =
    quality === 'good' ? '#22c55e' : quality === 'fair' ? '#facc15' : quality === 'poor' ? '#ef4444' : '#6b7280';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 6 + i * 4,
            borderRadius: 1,
            backgroundColor: i < filled ? color : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </View>
  );
}

export function CallOverlay() {
  const {
    status,
    peerId,
    mode,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    peerMuted,
    peerCameraOff,
    peerSharingScreen,
    callDurationSec,
    quality,
    speakerOn,
    error,
    acceptIncoming,
    declineIncoming,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
  } = useCall();

  const [localStreamURL, setLocalStreamURL] = useState<string | null>(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState<string | null>(null);

  useEffect(() => {
    setLocalStreamURL(localStream ? localStream.toURL() : null);
  }, [localStream]);

  useEffect(() => {
    setRemoteStreamURL(remoteStream ? remoteStream.toURL() : null);
  }, [remoteStream]);

  // Vibrate + haptics while incoming, stop when answered/declined
  useEffect(() => {
    if (status === 'incoming_ringing') {
      Vibration.vibrate(VIBRATION_PATTERN, true);
      const hapticTimer = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 1500);
      return () => {
        Vibration.cancel();
        clearInterval(hapticTimer);
      };
    }
    return undefined;
  }, [status]);

  const { data: peer } = usePublicProfile({
    variables: { id: peerId ?? '' },
    enabled: !!peerId,
  });

  useEffect(() => {
    if (!error) return;
    const peerName = peer?.name ?? peer?.username ?? '';
    if (error === 'offline') {
      Alert.alert(
        translate('call.peer_offline_title'),
        translate('call.peer_offline_message', { name: peerName })
      );
    } else if (error === 'busy') {
      Alert.alert(
        translate('call.peer_busy_title'),
        translate('call.peer_busy_message', { name: peerName })
      );
    } else if (error === 'declined') {
      Alert.alert(translate('call.ended_by_peer'));
    }
  }, [error, peer]);

  if (status === 'idle') return null;

  const statusLabel = (() => {
    switch (status) {
      case 'outgoing_ringing':
        return translate('call.ringing');
      case 'incoming_ringing':
        return translate('call.incoming_title');
      case 'connecting':
        return translate('call.connecting');
      default:
        return '';
    }
  })();

  const peerLabel = peer?.name ?? peer?.username ?? '';
  const isVideo = mode === 'video';
  // Render remote video if peer has any kind of video active — camera or
  // screen share. When camera is off but screen share is on, we still want
  // to render frames.
  const showRemoteVideo =
    isVideo &&
    remoteStreamURL &&
    status === 'active' &&
    (!peerCameraOff || peerSharingScreen);
  const showLocalSelfView =
    isVideo &&
    localStreamURL &&
    !isCameraOff &&
    status !== 'incoming_ringing';

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <View className="flex-1 bg-black">
        {/* Remote video full-screen */}
        {showRemoteVideo ? (
          <RTCView
            key={remoteStreamURL}
            streamURL={remoteStreamURL}
            style={StyleSheet.absoluteFillObject}
            // When peer is sharing screen, use "contain" so the whole
            // presentation/window fits without cropping
            objectFit={peerSharingScreen ? 'contain' : 'cover'}
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <View className="h-32 w-32 rounded-full bg-neutral-800 items-center justify-center">
              <Text className="text-5xl text-white">
                {peerLabel?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text className="mt-6 text-2xl font-bold text-white">
              {peerLabel || translate('call.title')}
            </Text>
            {statusLabel ? (
              <Text className="mt-2 text-base text-white/70">{statusLabel}</Text>
            ) : null}
            {status === 'active' && peerCameraOff ? (
              <Text className="mt-1 text-sm text-white/50">
                {translate('call.peer_camera_off')}
              </Text>
            ) : null}
            {status === 'incoming_ringing' ? (
              <Text className="mt-1 text-sm text-white/60">
                {translate(
                  mode === 'audio'
                    ? 'call.incoming_audio_from'
                    : 'call.incoming_from',
                  { name: peerLabel }
                )}
              </Text>
            ) : null}
          </View>
        )}

        {/* Top status bar (active call): timer + quality + peer mute icon */}
        {status === 'active' ? (
          <View
            style={{
              position: 'absolute',
              top: 50,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 5,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            >
              <QualityBars quality={quality} />
              <Text className="text-white font-semibold">
                {formatDuration(callDurationSec)}
              </Text>
              {peerMuted ? (
                <Ionicons name="mic-off" size={16} color="#ef4444" />
              ) : null}
              {peerSharingScreen ? (
                <Ionicons name="desktop-outline" size={16} color="#facc15" />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Local self-view (video mode only) */}
        {showLocalSelfView ? (
          <View
            style={{
              position: 'absolute',
              right: 16,
              top: 100,
              width: 110,
              height: 150,
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: '#000',
              zIndex: 10,
            }}
          >
            <RTCView
              key={localStreamURL}
              streamURL={localStreamURL}
              style={{ width: '100%', height: '100%' }}
              objectFit="cover"
              mirror
              zOrder={1}
            />
          </View>
        ) : null}

        {/* Controls */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 40,
            paddingHorizontal: 24,
            zIndex: 20,
          }}
        >
          {status === 'incoming_ringing' ? (
            <View className="flex-row items-center justify-around">
              <Pressable
                onPress={declineIncoming}
                className="h-16 w-16 rounded-full items-center justify-center bg-red-500"
                accessibilityLabel={translate('call.decline')}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </Pressable>
              <Pressable
                onPress={acceptIncoming}
                className="h-16 w-16 rounded-full items-center justify-center bg-green-500"
                accessibilityLabel={translate('call.accept')}
              >
                <Ionicons
                  name={mode === 'audio' ? 'call' : 'videocam'}
                  size={28}
                  color="#fff"
                />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row items-center justify-around">
              <Pressable
                onPress={toggleMute}
                className="h-14 w-14 rounded-full items-center justify-center bg-white/15"
                accessibilityLabel={
                  isMuted ? translate('call.unmute') : translate('call.mute')
                }
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color="#fff"
                />
              </Pressable>
              {mode === 'video' ? (
                <Pressable
                  onPress={toggleCamera}
                  className="h-14 w-14 rounded-full items-center justify-center bg-white/15"
                  accessibilityLabel={
                    isCameraOff
                      ? translate('call.camera_on')
                      : translate('call.camera_off')
                  }
                >
                  <Ionicons
                    name={isCameraOff ? 'videocam-off' : 'videocam'}
                    size={24}
                    color="#fff"
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={toggleSpeaker}
                  className="h-14 w-14 rounded-full items-center justify-center bg-white/15"
                  accessibilityLabel={translate('call.speaker')}
                >
                  <Ionicons
                    name={speakerOn ? 'volume-high' : 'volume-medium'}
                    size={24}
                    color={speakerOn ? '#facc15' : '#fff'}
                  />
                </Pressable>
              )}
              {mode === 'video' ? (
                <Pressable
                  onPress={switchCamera}
                  className="h-14 w-14 rounded-full items-center justify-center bg-white/15"
                  accessibilityLabel={translate('call.switch_camera')}
                >
                  <Ionicons name="camera-reverse" size={24} color="#fff" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={endCall}
                className="h-16 w-16 rounded-full items-center justify-center bg-red-500"
                accessibilityLabel={translate('call.end')}
              >
                <Ionicons name="call" size={26} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
