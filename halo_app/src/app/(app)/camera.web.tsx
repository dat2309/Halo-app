import { useRouter } from 'expo-router';
import React from 'react';

import { GlassContainer, GlassHeader } from '@/components/glass';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function CameraWebStub() {
  const router = useRouter();
  return (
    <GlassContainer>
      <FocusAwareStatusBar />
      <GlassHeader title="Camera" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-xl font-bold text-white mb-2">
          Camera not available on web
        </Text>
        <Text className="text-center text-white/70 mb-8">
          Use the mobile app to capture photos and videos. The web build is
          read-only for the camera feature.
        </Text>
        <Button label="Go back" onPress={() => router.back()} />
      </View>
    </GlassContainer>
  );
}
