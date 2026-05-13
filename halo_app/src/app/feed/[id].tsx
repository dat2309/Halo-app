import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import { usePost } from '@/api';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Image,
  Text,
  View,
} from '@/components/ui';
import { resolveMediaUrl } from '@/lib/media-url';

export default function Post() {
  const local = useLocalSearchParams<{ id: string }>();
  const postId = local.id;

  const { data, isPending, isError, refetch } = usePost({
    variables: { id: postId as string },
    enabled: typeof postId === 'string' && postId.length > 0,
  });

  if (isPending) {
    return (
      <View className="flex-1 justify-center  p-3">
        <Stack.Screen options={{ title: 'Post', headerBackTitle: 'Feed' }} />
        <FocusAwareStatusBar />
        <ActivityIndicator />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="flex-1 justify-center items-center p-3">
        <Stack.Screen options={{ title: 'Post', headerBackTitle: 'Feed' }} />
        <FocusAwareStatusBar />
        <Text className="text-center mb-4">Error loading post</Text>
        <Button label="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View className="flex-1 p-3 ">
      <Stack.Screen options={{ title: 'Post', headerBackTitle: 'Feed' }} />
      <FocusAwareStatusBar />
      <Image
        source={{ uri: resolveMediaUrl(data.mediaUrl) }}
        className="h-80 w-full rounded-2xl"
        contentFit="cover"
      />
      {data.caption ? (
        <Text className="mt-3 text-base font-semibold text-white">
          {data.caption}
        </Text>
      ) : null}
    </View>
  );
}
