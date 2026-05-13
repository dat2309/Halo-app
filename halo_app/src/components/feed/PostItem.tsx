import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';

import type { PostDto } from '@/api/posts/types';
import { resolveMediaUrl } from '@/lib/media-url';
import { PostOverlay } from './PostOverlay';
import { ReactionButton } from './ReactionButton';
import { Pressable, Text } from '@/components/ui';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import { FloatingHearts } from './FloatingHearts';

type Props = {
    item: PostDto;
    isVisible: boolean;
    currentUserId?: string;
    onComment: () => void;
    onToggleReaction: () => void;
    isReacting?: boolean;
};

export const PostItem = React.memo(
    ({ item, isVisible, currentUserId, onComment, onToggleReaction, isReacting }: Props) => {
        const videoRef = useRef<Video>(null);
        const isFocused = useIsFocused();
        const isVideo = item.type === 'video';
        const mediaUrl = resolveMediaUrl(item.mediaUrl);
        const avatarUrl = item.userId?.avatar
            ? resolveMediaUrl(item.userId.avatar)
            : `https://ui-avatars.com/api/?name=${item.userId?.name ?? 'User'}&background=random`;

        // Optimistic like state
        const hasReacted = currentUserId && item.reactions?.some((r) => {
            const rUserId = typeof r.userId === 'string' ? r.userId : (r.userId as any)?._id || (r.userId as any)?.id || String(r.userId);
            return String(rUserId) === String(currentUserId);
        });

        const [triggerCount, setTriggerCount] = useState(0);

        useEffect(() => {
            if (!videoRef.current) return;
            if (isVisible && isFocused) {
                videoRef.current.playAsync();
            } else {
                videoRef.current.pauseAsync();
            }
        }, [isVisible, isFocused]);

        return (
            <View
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center' }}
                className="bg-white dark:bg-black"
            >
                <View className="mx-4">
                    <View
                        className="relative w-full aspect-[3/5] rounded-[35px] overflow-hidden bg-gray-100 dark:bg-zinc-900 shadow-xl border border-gray-200 dark:border-white/5"
                    >
                        {/* Media Layer */}
                        {isVideo ? (
                            <Video
                                ref={videoRef}
                                source={{ uri: mediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.COVER}
                                isLooping
                                shouldPlay={isVisible && isFocused}
                                isMuted={false}
                            />
                        ) : (
                            <Image
                                source={{ uri: mediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                        )}

                        <PostOverlay
                            username={item.userId?.name ?? 'Unknown'}
                            avatarUrl={avatarUrl}
                            createdAt={item.createdAt}
                            caption={item.caption}
                        />

                        {/* Floating Hearts Animation */}
                        <FloatingHearts triggerCount={triggerCount} isVisible={isVisible} />
                    </View>

                    {/* Interactions Layer - Now below the widget like Locket/IG */}
                    <View className="flex-row items-center justify-between px-2 mt-3">
                        <View className="flex-1 mr-4">
                            <Pressable
                                onPress={onComment}
                                className="h-12 flex-row items-center bg-gray-100 dark:bg-zinc-800/50 rounded-full px-4 border border-gray-200 dark:border-white/5"
                            >
                                <Text className="text-gray-500 dark:text-white/50 text-sm">Send a reply...</Text>
                            </Pressable>
                        </View>

                        <View className="flex-row items-center gap-3">
                            <View className="items-center">
                                <ReactionButton
                                    isLiked={!!hasReacted}
                                    onToggle={() => {
                                        // Instant animation trigger before signal returns
                                        if (!hasReacted) {
                                            setTriggerCount(prev => prev + 1);
                                        }
                                        onToggleReaction();
                                    }}
                                    disabled={isReacting}
                                />
                                {item.reactionCount > 0 && (
                                    <Text className="text-[10px] font-bold text-gray-500 dark:text-white/70 mt-0.5">
                                        {item.reactionCount}
                                    </Text>
                                )}
                            </View>

                            <View className="items-center">
                                <Pressable
                                    onPress={onComment}
                                    className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800/50"
                                >
                                    <Text className="text-xl">💬</Text>
                                </Pressable>
                                {item.commentCount > 0 && (
                                    <Text className="text-[10px] font-bold text-gray-500 dark:text-white/70 mt-0.5">
                                        {item.commentCount}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );
    }
);
