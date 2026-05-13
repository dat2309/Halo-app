import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePublicProfile, useUserPosts, useSendRequest } from '@/api';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Image,
  Text,
  TouchableOpacity,
  View,
} from '@/components/ui';
import { resolveMediaUrl } from '@/lib/media-url';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: profile, isPending: profileLoading } = usePublicProfile({
    variables: { id: id as string },
    enabled: !!id,
  });

  const { data: postsData, isPending: postsLoading, fetchNextPage, hasNextPage } =
    useUserPosts({
      variables: { userId: id as string, limit: 12 },
      enabled: !!id,
    });

  const { mutate: sendRequest, isPending: sending } = useSendRequest();

  const posts = React.useMemo(() => {
    if (!postsData?.pages) return [];
    return postsData.pages.flatMap((p) => p.list);
  }, [postsData]);

  const totalPosts = postsData?.pages?.[0]?.total ?? 0;

  if (profileLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Stack.Screen options={{ headerShown: false }} />
        <FocusAwareStatusBar />
        <ActivityIndicator />
      </View>
    );
  }

  const renderHeader = () => (
    <View className="px-4 pb-4">
      <View className="flex-row items-center mb-6" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-yellow-400 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 dark:text-white ml-4">
          @{profile?.username ?? ''}
        </Text>
      </View>

      <View className="items-center mb-4">
        <Image
          source={{
            uri: profile?.avatar ? resolveMediaUrl(profile.avatar) : undefined,
          }}
          className="h-24 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700"
          contentFit="cover"
        />
        <Text className="mt-3 text-xl font-bold text-gray-900 dark:text-white">
          {profile?.name}
        </Text>
        {profile?.bio ? (
          <Text className="mt-1 text-center text-gray-500 dark:text-neutral-400 px-8">
            {profile.bio}
          </Text>
        ) : null}
      </View>

      <View className="flex-row justify-center gap-8 mb-4">
        <View className="items-center">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {totalPosts}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-neutral-400">Posts</Text>
        </View>
      </View>

      <Button
        label={sending ? 'Sending...' : 'Add Friend'}
        onPress={() => {
          if (profile?.username) {
            sendRequest({ username: profile.username });
          }
        }}
        disabled={sending}
        size="sm"
      />

      {posts.length > 0 && (
        <Text className="mt-6 mb-2 text-sm font-semibold text-gray-500 dark:text-neutral-400">
          Posts
        </Text>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />
      <FlatList
        data={posts}
        numColumns={NUM_COLUMNS}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/feed/${item._id}`)}
            style={{
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              margin: GRID_GAP / 2,
            }}
          >
            <Image
              source={{ uri: resolveMediaUrl(item.mediaUrl) }}
              className="flex-1 rounded-sm"
              contentFit="cover"
            />
          </TouchableOpacity>
        )}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          postsLoading ? <ActivityIndicator className="py-4" /> : null
        }
        ListEmptyComponent={
          !postsLoading ? (
            <Text className="text-center text-gray-500 dark:text-neutral-400 py-8">
              No posts yet
            </Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />
    </>
  );
}
