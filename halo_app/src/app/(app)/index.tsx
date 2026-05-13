import { useQueryClient } from '@tanstack/react-query';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, RefreshControl } from 'react-native';

import { useMe, usePosts, useToggleReaction } from '@/api';
import type { PostDto } from '@/api/posts/types';
import { CommentsSheet } from '@/components/comments/CommentsSheet';
import { PostItem } from '@/components/feed/PostItem';
import {
  FocusAwareStatusBar,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { getSocket } from '@/lib/socket';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fixed tab bar height (matches GlassBottomTab height)
const TAB_BAR_HEIGHT = 80;

export default function Feed() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts();
  const { data: me } = useMe({
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const currentUserId = me?.data?._id ? String(me.data._id) : undefined;

  // Interaction Logic
  const { mutateAsync: toggleReaction } = useToggleReaction({
    onSuccess: (responseData, variables) => {
      // Opt-out of full refetch, update local cache instead
      queryClient.setQueryData(['posts'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            list: page.list.map((post: PostDto) => {
              if (post._id === variables.postId) {
                // Update reaction status and count based on response
                let updatedReactions = post.reactions || [];

                if (responseData.action === 'added') {
                  // Add and deduplicate by userId
                  updatedReactions = [...updatedReactions, responseData.reaction].filter((v, i, a) => {
                    const vId = typeof v.userId === 'string' ? v.userId : v.userId?._id;
                    return a.findIndex(t => {
                      const tId = typeof t.userId === 'string' ? t.userId : t.userId?._id;
                      return tId === vId;
                    }) === i;
                  });
                } else {
                  // Remove
                  updatedReactions = updatedReactions.filter((r) => {
                    const rUserId = typeof r.userId === 'string' ? r.userId : r.userId?._id;
                    return String(rUserId) !== String(currentUserId);
                  });
                }

                return {
                  ...post,
                  reactions: updatedReactions,
                  reactionCount: responseData.action === 'added'
                    ? post.reactionCount + 1
                    : Math.max(0, post.reactionCount - 1),
                };
              }
              return post;
            }),
          })),
        };
      });
    },
  });

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Realtime
  useEffect(() => {
    let socketInstance: any;

    getSocket().then(socket => {
      if (!socket) return;
      socketInstance = socket;

      socket.on('reaction:updated', (data: { postId: string; reactionCount: number; action: string; reaction: any }) => {
        const reactionUserId = typeof data.reaction?.userId === 'string' ? data.reaction?.userId : data.reaction?.userId?._id;
        const isMyOwnAction = String(reactionUserId) === String(currentUserId);

        // Granular update from socket
        queryClient.setQueryData(['posts'], (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              list: page.list.map((post: PostDto) => {
                if (post._id === data.postId) {
                  // If it's my own action, a more accurate update (including reaction object)
                  // was already performed in onSuccess. We only sync the count here to match server.
                  if (isMyOwnAction) {
                    return {
                      ...post,
                    };
                  }

                  // For others, update the reactions array robustly
                  let updatedReactions = post.reactions || [];
                  if (data.action === 'added') {
                    updatedReactions = [...updatedReactions, data.reaction].filter((v, i, a) => {
                      const vId = typeof v.userId === 'string' ? v.userId : v.userId?._id;
                      return a.findIndex(t => {
                        const tId = typeof t.userId === 'string' ? t.userId : t.userId?._id;
                        return tId === vId;
                      }) === i;
                    });
                  } else {
                    updatedReactions = updatedReactions.filter((r) => {
                      const rUserId = typeof r.userId === 'string' ? r.userId : r.userId?._id;
                      return String(rUserId) !== String(reactionUserId);
                    });
                  }

                  return {
                    ...post,
                    reactionCount: data.reactionCount,
                    reactions: updatedReactions,
                  };
                }
                return post;
              }),
            })),
          };
        });
      });

      socket.on('comment:updated', (data: { postId: string; commentCount: number }) => {
        console.log('[Socket] Received comment:updated:', data);
        queryClient.setQueryData(usePosts.getKey(), (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              list: page.list.map((post: any) => {
                if (post._id === data.postId) {
                  return {
                    ...post,
                    commentCount: data.commentCount,
                  };
                }
                return post;
              }),
            })),
          };
        });
      });

      socket.on('post:created', () => refetch());
    });

    return () => {
      if (socketInstance) {
        socketInstance.off('reaction:updated');
        socketInstance.off('comment:updated');
        socketInstance.off('post:created');
      }
    };
  }, [refetch, queryClient, currentUserId]);

  // Viewability / Auto-play logic
  const [viewableItems, setViewableItems] = useState<ViewToken[]>([]);
  const onViewableItemsChanged = useCallback(({ viewableItems: vItems }: { viewableItems: ViewToken[] }) => {
    setViewableItems(vItems);
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  // Flatten paginated data
  const items = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.list);
  }, [data]);

  const handleReaction = useCallback(async (post: PostDto) => {
    await toggleReaction({ postId: post._id });
  }, [toggleReaction]);

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-gray-900 dark:text-white">Error loading feed</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <FocusAwareStatusBar />
      {/* Search FAB */}
      <Pressable
        onPress={() => router.push('/search')}
        className="absolute top-14 right-4 z-50 h-10 w-10 items-center justify-center rounded-full bg-black/40"
      >
        <Text className="text-white text-lg">🔍</Text>
      </Pressable>
      <FlashList
        data={items}
        renderItem={({ item }) => {
          const isVisible = viewableItems.some(
            (v) => v.key === item._id && v.isViewable
          );
          return (
            <PostItem
              item={item}
              isVisible={isVisible}
              currentUserId={currentUserId}
              onComment={() => setSelectedPostId(item._id)}
              onToggleReaction={() => handleReaction(item)}
            />
          );
        }}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT, paddingTop: 0 }}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={SCREEN_HEIGHT}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={isPending}
            onRefresh={refetch}
            tintColor={Platform.OS === 'ios' ? '#000' : undefined}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ height: SCREEN_HEIGHT }} className="items-center justify-center">
              <Text className="text-gray-900 dark:text-white">Loading more...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isPending ? (
            <View style={{ height: SCREEN_HEIGHT }} className="items-center justify-center">
              <Text className="text-gray-900 dark:text-white">Loading...</Text>
            </View>
          ) : (
            <View style={{ height: SCREEN_HEIGHT }} className="items-center justify-center px-6">
              <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">No photos yet.</Text>
              <Link href="/camera" asChild>
                <Pressable className="rounded-full bg-yellow-400 px-6 py-3">
                  <Text className="font-bold text-black">Tap to start!</Text>
                </Pressable>
              </Link>
            </View>
          )
        }
      />

      {selectedPostId && (
        <CommentsSheet
          postId={selectedPostId}
          currentUserId={currentUserId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </View>
  );
}
