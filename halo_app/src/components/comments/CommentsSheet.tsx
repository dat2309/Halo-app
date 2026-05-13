import React, { useEffect, useMemo, useState } from 'react';
import { MotiView } from 'moti';
import { BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Platform, RefreshControl } from 'react-native';
import { Send } from 'lucide-react-native';

import {
  useAddComment,
  useComments,
  useDeleteComment,
} from '@/api';
import type { CommentDto } from '@/api/comments';
import { GlassModal } from '@/components/glass';
import {
  FocusAwareStatusBar,
  Text,
  View,
  Pressable,
} from '@/components/ui';
import { getSocket } from '@/lib/socket';

type Props = {
  postId: string;
  currentUserId?: string;
  onClose: () => void;
};

export function CommentsSheet({ postId, currentUserId, onClose }: Props) {
  const { data, refetch, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useComments({
    variables: { postId, limit: 20 },
  });
  const { mutateAsync: addComment, isPending } = useAddComment();
  const { mutateAsync: deleteComment, isPending: deleting } =
    useDeleteComment();

  const [content, setContent] = React.useState('');

  useEffect(() => {
    let socketInstance: any;

    getSocket().then(socket => {
      if (!socket) return;
      socketInstance = socket;
      const handler = (payload: { postId: string }) => {
        if (payload.postId === postId) {
          refetch();
        }
      };
      socket.on('comment:created', handler);
      socket.on('comment:deleted', handler);
    });

    return () => {
      if (socketInstance) {
        socketInstance.off('comment:created');
        socketInstance.off('comment:deleted');
      }
    };
  }, [postId, refetch]);

  // Flatten paginated data and deduplicate
  const items = useMemo(() => {
    if (!data?.pages) return [];
    const allComments = data.pages.flatMap(page => page.list);
    const map = new Map<string, CommentDto>();
    allComments.forEach((c) => map.set(c._id, c));
    return Array.from(map.values());
  }, [data]);

  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);

  const submit = async () => {
    if (!content.trim()) return;
    await addComment(
      { postId, content, parentId: replyTo?._id },
      {
        onSuccess: () => {
          setContent('');
          setReplyTo(null);
          refetch();
        },
      }
    );
  };

  const threadedItems = useMemo(() => {
    const roots = items.filter(i => !i.parentId);
    const replies = items.filter(i => i.parentId);

    const result: CommentDto[] = [];
    roots.forEach(root => {
      result.push(root);
      const childReplies = replies.filter(r => r.parentId === root._id);
      result.push(...childReplies);
    });
    // Add any replies that somehow didn't have their parent in the current page
    replies.forEach(r => {
      if (!result.find(i => i._id === r._id)) {
        result.push(r);
      }
    });
    return result;
  }, [items]);

  return (
    <GlassModal title="Comments" onDismiss={onClose}>
      <FocusAwareStatusBar />
      <View className="flex-1">
        <View className="flex-1">
          {items.length ? (
            <BottomSheetFlatList
              data={threadedItems}
              keyExtractor={(item) => item._id}
              refreshControl={
                <RefreshControl
                  refreshing={isFetching}
                  onRefresh={refetch}
                  tintColor={Platform.OS === 'ios' ? '#fff' : undefined}
                />
              }
              renderItem={({ item: comment }) => {
                const isReply = !!comment.parentId;
                return (
                  <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`mb-3 p-3 rounded-2xl ${isReply ? 'ml-8 bg-white/5' : 'bg-white/10'}`}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-white/50 mb-1">
                          {comment.userId?.name ?? 'User'}
                        </Text>
                        <Text className="text-white text-base leading-5">{comment.content}</Text>

                        <View className="flex-row mt-2 gap-4">
                          {!isReply && (
                            <Pressable onPress={() => {
                              setReplyTo(comment);
                              setContent(`@${comment.userId?.name} `);
                            }}>
                              <Text className="text-blue-400 text-xs font-bold">Reply</Text>
                            </Pressable>
                          )}
                          <Text className="text-white/30 text-[10px] self-center">
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>

                      {comment.userId?._id === currentUserId && (
                        <Pressable
                          onPress={() => deleteComment({ postId, id: comment._id }, { onSuccess: () => refetch() })}
                          disabled={deleting}
                          className="ml-2 p-1"
                        >
                          <Text className="text-red-400/50 text-xs text-right">Delete</Text>
                        </Pressable>
                      )}
                    </View>
                  </MotiView>
                );
              }}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.2}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View className="py-4 items-center">
                    <Text className="text-white/40 text-xs">Loading more...</Text>
                  </View>
                ) : <View className="h-10" />
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-white/30 italic">
                {isFetching ? 'Loading comments...' : 'Be the first to comment'}
              </Text>
            </View>
          )}
        </View>

        <View className="pt-2 pb-6">
          {replyTo && (
            <View className="flex-row items-center justify-between bg-blue-500/20 px-3 py-1 rounded-t-lg border-b border-blue-500/30">
              <Text className="text-[10px] text-blue-300">
                Replying to <Text className="font-bold">{replyTo.userId?.name}</Text>
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Text className="text-blue-300 text-xs px-1">✕</Text>
              </Pressable>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <BottomSheetTextInput
                placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
                value={content}
                onChangeText={setContent}
                returnKeyType="send"
                onSubmitEditing={submit}
                placeholderTextColor="rgba(255,255,255,0.3)"
                className={`bg-white/10 border-0 text-white min-h-[48px] px-4 rounded-xl ${replyTo ? 'rounded-t-none' : ''}`}
                style={{ color: 'white' }}
              />
            </View>
            <Pressable
              onPress={submit}
              disabled={isPending || !content.trim()}
              className={`h-12 w-12 items-center justify-center rounded-2xl ${content.trim() ? 'bg-blue-500' : 'bg-white/5'}`}
            >
              <Send size={20} color="white" />
            </Pressable>
          </View>
        </View>
      </View>
    </GlassModal>
  );
}
