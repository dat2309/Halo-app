import { useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSearchUsers, useDiscoverPosts } from '@/api';
import type { SearchUserDto } from '@/api';
import type { PostDto } from '@/api/posts/types';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Image,
  Input,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from '@/components/ui';
import { resolveMediaUrl } from '@/lib/media-url';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1) - 24) / NUM_COLUMNS;

type TabType = 'users' | 'posts';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: usersData,
    isPending: usersLoading,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasMoreUsers,
  } = useSearchUsers({
    variables: { q: searchQuery },
    enabled: searchQuery.length > 0 && activeTab === 'users',
  });

  const {
    data: postsData,
    isPending: postsLoading,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasMorePosts,
  } = useDiscoverPosts({
    variables: { q: searchQuery },
    enabled: activeTab === 'posts',
  });

  const users = React.useMemo(() => {
    if (!usersData?.pages) return [];
    return usersData.pages.flatMap((p) => p.list);
  }, [usersData]);

  const posts = React.useMemo(() => {
    if (!postsData?.pages) return [];
    return postsData.pages.flatMap((p) => p.list);
  }, [postsData]);

  const handleSearch = useCallback(() => {
    setSearchQuery(query.trim());
  }, [query]);

  const renderUserItem = useCallback(
    ({ item }: { item: SearchUserDto }) => (
      <Pressable
        onPress={() => router.push(`/user/${item._id}`)}
        className="flex-row items-center gap-3 px-4 py-3"
      >
        <Image
          source={{
            uri: item.avatar ? resolveMediaUrl(item.avatar) : undefined,
          }}
          className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700"
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {item.name}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-neutral-400">
            @{item.username}
          </Text>
        </View>
      </Pressable>
    ),
    [router]
  );

  const renderPostItem = useCallback(
    ({ item }: { item: PostDto }) => (
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
    ),
    [router]
  );

  return (
    <>
      <FocusAwareStatusBar />
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View className="px-4 pb-2">
          <View className="flex-row items-center gap-3 mb-3">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-yellow-400 text-lg">Back</Text>
            </TouchableOpacity>
            <Text className="text-xl font-bold text-yellow-400">
              Discover
            </Text>
          </View>

          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search users or posts..."
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />

          <View className="flex-row mt-3 gap-2">
            <Pressable
              onPress={() => setActiveTab('users')}
              className={`flex-1 items-center py-2 rounded-xl ${
                activeTab === 'users'
                  ? 'bg-yellow-400'
                  : 'bg-neutral-100 dark:bg-white/10'
              }`}
            >
              <Text
                className={`font-semibold ${
                  activeTab === 'users'
                    ? 'text-black'
                    : 'text-gray-500 dark:text-white/70'
                }`}
              >
                Users
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('posts')}
              className={`flex-1 items-center py-2 rounded-xl ${
                activeTab === 'posts'
                  ? 'bg-yellow-400'
                  : 'bg-neutral-100 dark:bg-white/10'
              }`}
            >
              <Text
                className={`font-semibold ${
                  activeTab === 'posts'
                    ? 'text-black'
                    : 'text-gray-500 dark:text-white/70'
                }`}
              >
                Posts
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'users' ? (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderUserItem}
            onEndReached={() => {
              if (hasMoreUsers) fetchNextUsers();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              usersLoading ? <ActivityIndicator className="py-4" /> : null
            }
            ListEmptyComponent={
              !usersLoading && searchQuery ? (
                <Text className="text-center text-gray-500 dark:text-neutral-400 py-8">
                  No users found
                </Text>
              ) : !searchQuery ? (
                <Text className="text-center text-gray-500 dark:text-neutral-400 py-8">
                  Search for users by name or username
                </Text>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          />
        ) : (
          <FlatList
            data={posts}
            numColumns={NUM_COLUMNS}
            keyExtractor={(item) => item._id}
            renderItem={renderPostItem}
            onEndReached={() => {
              if (hasMorePosts) fetchNextPosts();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              postsLoading ? <ActivityIndicator className="py-4" /> : null
            }
            ListEmptyComponent={
              !postsLoading ? (
                <Text className="text-center text-gray-500 dark:text-neutral-400 py-8">
                  {searchQuery ? 'No posts found' : 'Discover posts from everyone'}
                </Text>
              ) : null
            }
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: insets.bottom + 100,
            }}
          />
        )}
      </View>
    </>
  );
}
