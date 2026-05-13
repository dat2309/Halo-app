import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConversations, useMe, type ConversationDto } from '@/api';
import { GlassContainer, GlassHeader } from '@/components/glass';
import {
    FocusAwareStatusBar,
    Image,
    Text,
    View,
} from '@/components/ui';
import { translate } from '@/lib';
import { resolveMediaUrl } from '@/lib/media-url';
import { getSocket } from '@/lib/socket';

function getPeer(conv: ConversationDto, meId?: string) {
    const participants = conv.participants ?? [];
    // Backend may occasionally return participants as raw ObjectId strings if
    // a write path forgot to populate — coerce those into a minimal object so
    // rendering doesn't show "Unknown".
    const normalized = participants.map((p: any) =>
        typeof p === 'string' ? { _id: p } : p
    );
    if (meId) {
        const peer = normalized.find((p: any) => String(p._id) !== String(meId));
        if (peer) return peer;
    }
    // Fallback: second participant (skip self if order is sorted)
    return normalized[1] ?? normalized[0];
}

function peerDisplayName(peer: any): string {
    const name = (peer?.name ?? '').trim();
    if (name) return name;
    const username = (peer?.username ?? '').trim();
    if (username) return `@${username}`;
    if (peer?._id) return `User ${String(peer._id).slice(-4)}`;
    return 'Unknown';
}

function timeAgo(iso?: string) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
}

export default function ChatList() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data: me } = useMe();
    const meId = me?.data?._id;

    const {
        data: conversations,
        isPending,
        refetch,
        isRefetching,
    } = useConversations();

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
        let active = true;
        let socketRef: any = null;
        getSocket().then((s) => {
            if (!s || !active) return;
            socketRef = s;
            const onUpdate = () => refetch();
            s.on('chat:message', onUpdate);
            s.on('chat:conversation_updated', onUpdate);
            s.on('chat:read', onUpdate);
        });
        return () => {
            active = false;
            if (socketRef) {
                socketRef.off('chat:message');
                socketRef.off('chat:conversation_updated');
                socketRef.off('chat:read');
            }
        };
    }, [refetch]);

    const renderItem = ({ item }: { item: ConversationDto }) => {
        const peer = getPeer(item, meId);
        const isUnread = item.unreadCount > 0;
        return (
            <Pressable
                onPress={() => router.push(`/chat/${item._id}` as any)}
                className="flex-row items-center px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-900"
            >
                <View className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    {peer?.avatar ? (
                        <Image
                            source={{ uri: resolveMediaUrl(peer.avatar) }}
                            className="h-full w-full"
                        />
                    ) : (
                        <View className="h-full w-full items-center justify-center">
                            <Text className="text-lg text-neutral-500">
                                {(peer?.name?.[0] ?? peer?.username?.[0] ?? '?').toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <View className="flex-1 ml-3">
                    <View className="flex-row items-center justify-between">
                        <Text
                            className={`text-base ${isUnread ? 'font-bold' : 'font-semibold'} text-gray-900 dark:text-white`}
                            numberOfLines={1}
                        >
                            {peerDisplayName(peer)}
                        </Text>
                        <Text className="text-xs text-neutral-500 ml-2">
                            {timeAgo(item.lastMessageAt)}
                        </Text>
                    </View>
                    <View className="flex-row items-center justify-between mt-0.5">
                        <Text
                            className={`flex-1 text-sm ${isUnread ? 'text-gray-900 dark:text-white font-semibold' : 'text-neutral-500'}`}
                            numberOfLines={1}
                        >
                            {item.lastMessage ?? translate('chat.empty_preview')}
                        </Text>
                        {isUnread ? (
                            <View className="ml-2 h-5 min-w-5 rounded-full bg-yellow-400 px-1.5 items-center justify-center">
                                <Text className="text-[11px] font-bold text-black">
                                    {item.unreadCount}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <GlassContainer>
            <FocusAwareStatusBar />
            <GlassHeader title={translate('chat.title')} />
            {isPending ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={conversations ?? []}
                    keyExtractor={(c) => c._id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                    }
                    contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
                    ListEmptyComponent={
                        <View className="items-center py-16">
                            <Text className="text-neutral-500">
                                {translate('chat.no_conversations')}
                            </Text>
                        </View>
                    }
                />
            )}
        </GlassContainer>
    );
}
