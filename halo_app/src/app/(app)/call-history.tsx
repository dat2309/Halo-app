import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    useCallHistory,
    useMe,
    type CallHistoryItem,
    type ChatParticipant,
} from '@/api';
import { GlassContainer, GlassHeader } from '@/components/glass';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { translate, useCall } from '@/lib';

function formatTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
    });
}

function durationLabel(item: CallHistoryItem) {
    if (!item.startedAt || !item.endedAt) return '';
    const sec = Math.max(
        0,
        Math.floor(
            (new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) /
                1000
        )
    );
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallHistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data: me } = useMe();
    const meId = me?.data?._id;
    const { startCall } = useCall();

    const { data, isPending, refetch, isRefetching } = useCallHistory({
        variables: { limit: 50 },
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const renderItem = ({ item }: { item: CallHistoryItem }) => {
        const callerObj =
            typeof item.callerId === 'string'
                ? ({ _id: item.callerId } as ChatParticipant)
                : (item.callerId as ChatParticipant);
        const calleeObj =
            typeof item.calleeId === 'string'
                ? ({ _id: item.calleeId } as ChatParticipant)
                : (item.calleeId as ChatParticipant);
        const iAmCaller = callerObj._id === meId;
        const peer = iAmCaller ? calleeObj : callerObj;
        const peerName = peer.name ?? peer.username ?? translate('call.title');
        const isMissed = item.status === 'missed' && !iAmCaller;
        const isOutgoing = iAmCaller;

        const directionIcon = isMissed
            ? 'call-outline'
            : isOutgoing
              ? 'arrow-up-outline'
              : 'arrow-down-outline';
        const iconColor = isMissed
            ? '#ef4444'
            : isOutgoing
              ? '#22c55e'
              : '#3b82f6';

        const statusLabel =
            item.status === 'missed'
                ? translate('call.history_missed')
                : item.status === 'declined'
                  ? translate('call.history_declined')
                  : item.status === 'aborted'
                    ? translate('call.history_aborted')
                    : item.status === 'ended'
                      ? durationLabel(item)
                      : item.status;

        return (
            <Pressable
                onPress={() => peer._id && startCall(peer._id, 'video')}
                className="flex-row items-center px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-900"
            >
                <View className="h-11 w-11 rounded-full bg-neutral-200 dark:bg-neutral-700 items-center justify-center">
                    <Text className="text-lg text-neutral-700 dark:text-neutral-200">
                        {(peerName?.[0] ?? '?').toUpperCase()}
                    </Text>
                </View>
                <View className="flex-1 ml-3">
                    <Text
                        className={`text-base font-semibold ${
                            isMissed
                                ? 'text-red-500'
                                : 'text-gray-900 dark:text-white'
                        }`}
                        numberOfLines={1}
                    >
                        {peerName}
                    </Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons name={directionIcon as any} size={12} color={iconColor} />
                        <Text className="text-xs text-neutral-500">{statusLabel}</Text>
                    </View>
                </View>
                <View className="items-end">
                    <Text className="text-xs text-neutral-500">
                        {formatTime(item.createdAt)}
                    </Text>
                    <Pressable
                        onPress={() => peer._id && startCall(peer._id, 'video')}
                        hitSlop={8}
                        className="mt-1"
                        accessibilityLabel="Video call"
                    >
                        <Ionicons name="videocam" size={20} color="#facc15" />
                    </Pressable>
                </View>
            </Pressable>
        );
    };

    return (
        <GlassContainer>
            <FocusAwareStatusBar />
            <GlassHeader title={translate('call.history_title')} />
            {isPending ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={data ?? []}
                    keyExtractor={(s) => s._id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                    }
                    contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
                    ListEmptyComponent={
                        <View className="items-center py-16">
                            <Text className="text-neutral-500">
                                {translate('call.history_empty')}
                            </Text>
                        </View>
                    }
                />
            )}
        </GlassContainer>
    );
}
