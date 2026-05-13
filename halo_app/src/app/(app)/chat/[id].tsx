import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TextInput,
} from 'react-native';

const VIDEO_CALL_SUPPORTED = Platform.OS !== 'web';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    useConversations,
    useMarkConversationRead,
    useMe,
    useMessages,
    type ConversationDto,
    type MessageDto,
    type MessagesPage,
} from '@/api';
import { GlassContainer, GlassHeader } from '@/components/glass';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { translate, useCall } from '@/lib';
import { getSocket } from '@/lib/socket';

const TYPING_STOP_DELAY = 1500;

export default function ChatThread() {
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { id, peerId: peerIdParam } = useLocalSearchParams<{
        id: string;
        peerId?: string;
    }>();
    const conversationId = id as string;

    const queryClient = useQueryClient();
    const { data: me } = useMe();
    const meId = me?.data?._id;
    const { startCall } = useCall();

    // Hide parent (Tabs) tab bar while this thread is focused
    useFocusEffect(
        useCallback(() => {
            const parent = navigation.getParent();
            parent?.setOptions({ tabBarStyle: { display: 'none' } });
            return () => parent?.setOptions({ tabBarStyle: undefined });
        }, [navigation])
    );

    const [draft, setDraft] = useState('');
    const [peerTyping, setPeerTyping] = useState(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingEmittedRef = useRef(false);

    const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useMessages({ variables: { conversationId } });

    const { mutateAsync: markRead } = useMarkConversationRead();

    const messages = useMemo<MessageDto[]>(
        () => data?.pages.flatMap((p) => p.list) ?? [],
        [data]
    );

    // On mount: mark read via REST + emit socket read
    useEffect(() => {
        if (!conversationId) return;
        markRead({ conversationId }).catch(() => {});
        getSocket().then((s) => s?.emit('chat:read', { conversationId }));
    }, [conversationId, markRead]);

    // Subscribe to realtime events
    useEffect(() => {
        if (!conversationId) return;
        let active = true;
        let socketRef: any = null;

        const onMessage = (msg: MessageDto) => {
            if (msg.conversationId !== conversationId) return;
            queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: any[] }>(
                useMessages.getKey({ conversationId }),
                (old) => {
                    if (!old) return old;
                    const firstPage = old.pages[0];
                    if (!firstPage) return old;
                    if (firstPage.list.some((m) => m._id === msg._id)) return old;
                    return {
                        ...old,
                        pages: [
                            { ...firstPage, list: [msg, ...firstPage.list] },
                            ...old.pages.slice(1),
                        ],
                    };
                }
            );
            if (msg.senderId !== meId) {
                getSocket().then((s) => s?.emit('chat:read', { conversationId }));
            }
        };

        const onTyping = (data: {
            conversationId: string;
            userId: string;
            isTyping: boolean;
        }) => {
            if (data.conversationId !== conversationId) return;
            if (data.userId === meId) return;
            setPeerTyping(data.isTyping);
        };

        const onRead = () => {
            // Could refresh readBy receipts here; keep simple for now
        };

        getSocket().then((s) => {
            if (!s || !active) return;
            socketRef = s;
            s.on('chat:message', onMessage);
            s.on('chat:typing', onTyping);
            s.on('chat:read', onRead);
        });

        return () => {
            active = false;
            if (socketRef) {
                socketRef.off('chat:message', onMessage);
                socketRef.off('chat:typing', onTyping);
                socketRef.off('chat:read', onRead);
            }
        };
    }, [conversationId, meId, queryClient]);

    const emitTyping = useCallback(
        (isTyping: boolean) => {
            getSocket().then((s) =>
                s?.emit('chat:typing', { conversationId, isTyping })
            );
        },
        [conversationId]
    );

    const handleChangeText = (text: string) => {
        setDraft(text);
        if (!isTypingEmittedRef.current && text.length > 0) {
            isTypingEmittedRef.current = true;
            emitTyping(true);
        }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            isTypingEmittedRef.current = false;
            emitTyping(false);
        }, TYPING_STOP_DELAY);
    };

    const handleSend = async () => {
        const content = draft.trim();
        if (!content) return;
        setDraft('');
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (isTypingEmittedRef.current) {
            isTypingEmittedRef.current = false;
            emitTyping(false);
        }
        const socket = await getSocket();
        socket?.emit('chat:send', {
            conversationId,
            type: 'text',
            content,
        });
    };

    // Parse the `__call__{...}` payload our backend inserts when a call ends,
    // to render it as a system-style bubble inside the thread.
    const parseCallSummary = (content?: string) => {
        if (!content?.startsWith('__call__')) return null;
        try {
            return JSON.parse(content.slice('__call__'.length)) as {
                kind: 'call';
                mode: 'audio' | 'video';
                reason: 'ended' | 'declined' | 'aborted' | 'missed';
                durationSec: number;
                callerId: string;
                calleeId: string;
            };
        } catch {
            return null;
        }
    };

    const renderItem = ({ item, index }: { item: MessageDto; index: number }) => {
        const mine = item.senderId === meId;
        const callSummary = parseCallSummary(item.content);

        // System bubble for call summary
        if (callSummary) {
            const iAmCaller = callSummary.callerId === meId;
            const outgoing = iAmCaller;
            const missed = callSummary.reason === 'missed';
            const declined = callSummary.reason === 'declined';
            const aborted = callSummary.reason === 'aborted';
            const completed = callSummary.reason === 'ended';
            const iconColor = missed
                ? '#ef4444'
                : declined
                  ? '#ef4444'
                  : '#facc15';
            const label = missed
                ? outgoing
                    ? translate('call.summary_missed_outgoing')
                    : translate('call.summary_missed_incoming')
                : declined
                  ? outgoing
                      ? translate('call.summary_declined_outgoing')
                      : translate('call.summary_declined_incoming')
                  : aborted
                    ? translate('call.summary_aborted')
                    : outgoing
                      ? translate('call.summary_outgoing')
                      : translate('call.summary_incoming');
            const formattedDuration = completed
                ? ` · ${Math.floor(callSummary.durationSec / 60)}:${String(
                      callSummary.durationSec % 60
                  ).padStart(2, '0')}`
                : '';
            return (
                <View className="px-3 mt-3 items-center">
                    <View className="flex-row items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                        <Ionicons
                            name={
                                callSummary.mode === 'audio' ? 'call' : 'videocam'
                            }
                            size={16}
                            color={iconColor}
                        />
                        <Text className="text-xs text-neutral-700 dark:text-neutral-200">
                            {label}
                            {formattedDuration}
                        </Text>
                    </View>
                </View>
            );
        }

        const prev = messages[index + 1]; // older message (inverted list)
        const nextSameSender =
            index > 0 && messages[index - 1].senderId === item.senderId;
        const prevSameSender = prev && prev.senderId === item.senderId;
        return (
            <View
                className={`px-3 ${mine ? 'items-end' : 'items-start'} ${
                    nextSameSender ? 'mt-0.5' : 'mt-3'
                }`}
            >
                <View
                    className={`max-w-[78%] px-3 py-2 ${
                        mine
                            ? 'bg-yellow-400 rounded-2xl'
                            : 'bg-neutral-200 dark:bg-neutral-800 rounded-2xl'
                    } ${
                        mine
                            ? prevSameSender
                                ? 'rounded-br-md'
                                : ''
                            : prevSameSender
                              ? 'rounded-bl-md'
                              : ''
                    }`}
                >
                    <Text
                        className={`text-base ${
                            mine ? 'text-black' : 'text-gray-900 dark:text-white'
                        }`}
                    >
                        {item.content}
                    </Text>
                </View>
            </View>
        );
    };

    const peer = useMemo(() => {
        // 1. Param passed when navigating from friends list — most reliable
        if (peerIdParam) return peerIdParam;
        // 2. Conversation participants list from cache (if user came from chat index)
        const conversations = queryClient.getQueryData<ConversationDto[]>(
            useConversations.getKey()
        );
        const conv = conversations?.find((c) => c._id === conversationId);
        const otherFromConv = conv?.participants.find((p) => p._id !== meId)?._id;
        if (otherFromConv) return otherFromConv;
        // 3. Fallback: derive from existing message history
        const m = messages.find((x) => x.senderId !== meId);
        return m?.senderId;
    }, [peerIdParam, conversationId, messages, meId, queryClient]);

    const startVideoCall = useCallback(() => {
        if (!peer) return;
        startCall(peer, 'video');
    }, [startCall, peer]);

    const startAudioCall = useCallback(() => {
        if (!peer) return;
        startCall(peer, 'audio');
    }, [startCall, peer]);

    return (
        <GlassContainer>
            <FocusAwareStatusBar />
            <GlassHeader
                title={translate('chat.thread_title')}
                right={
                    VIDEO_CALL_SUPPORTED ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Pressable
                                onPress={startAudioCall}
                                disabled={!peer}
                                accessibilityLabel="Audio call"
                                accessibilityRole="button"
                                hitSlop={12}
                                style={({ pressed }) => ({
                                    opacity: !peer ? 0.4 : pressed ? 0.6 : 1,
                                    padding: 8,
                                })}
                            >
                                <Ionicons name="call" size={24} color="#fff" />
                            </Pressable>
                            <Pressable
                                onPress={startVideoCall}
                                disabled={!peer}
                                accessibilityLabel="Video call"
                                accessibilityRole="button"
                                hitSlop={12}
                                style={({ pressed }) => ({
                                    opacity: !peer ? 0.4 : pressed ? 0.6 : 1,
                                    padding: 8,
                                })}
                            >
                                <Ionicons name="videocam" size={26} color="#fff" />
                            </Pressable>
                        </View>
                    ) : undefined
                }
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {isPending ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator />
                    </View>
                ) : (
                    <FlatList
                        data={messages}
                        keyExtractor={(m) => m._id}
                        renderItem={renderItem}
                        inverted
                        onEndReached={() => {
                            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                        }}
                        onEndReachedThreshold={0.4}
                        ListFooterComponent={
                            isFetchingNextPage ? (
                                <View className="py-3 items-center">
                                    <ActivityIndicator size="small" />
                                </View>
                            ) : null
                        }
                        contentContainerStyle={{ paddingVertical: 12 }}
                        keyboardShouldPersistTaps="handled"
                    />
                )}

                {peerTyping ? (
                    <Text className="px-4 pb-1 text-xs text-neutral-500">
                        {translate('chat.typing')}
                    </Text>
                ) : null}

                <View
                    className="flex-row items-end gap-2 px-3 pt-2 bg-white dark:bg-black border-t border-neutral-200 dark:border-neutral-800"
                    style={{ paddingBottom: Math.max(insets.bottom, 8) + 8 }}
                >
                    <View className="flex-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-3 py-2 max-h-28">
                        <TextInput
                            value={draft}
                            onChangeText={handleChangeText}
                            placeholder={translate('chat.message_placeholder')}
                            placeholderTextColor={isDark ? '#737373' : '#9CA3AF'}
                            multiline
                            style={{
                                color: isDark ? '#FFFFFF' : '#111827',
                                fontSize: 15,
                                minHeight: 24,
                                maxHeight: 96,
                            }}
                        />
                    </View>
                    <Pressable
                        onPress={handleSend}
                        disabled={!draft.trim()}
                        className={`h-10 w-10 rounded-full items-center justify-center ${
                            draft.trim() ? 'bg-yellow-400' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                        accessibilityLabel="Send"
                    >
                        <Ionicons name="send" size={18} color="#000" />
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </GlassContainer>
    );
}
