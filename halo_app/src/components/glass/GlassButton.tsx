import React from 'react';
import { BlurView } from 'expo-blur';
import { MotiPressable } from 'moti/interactions';
import { ActivityIndicator } from 'react-native';
import { useColorScheme } from 'nativewind';

import { Text, View } from '@/components/ui';

type Props = {
  label: string;
  onPress: () => void;
  className?: string;
  loading?: boolean;
};

export function GlassButton({ label, onPress, className, loading }: Props): React.JSX.Element {
  const { colorScheme } = useColorScheme();
  return (
    <MotiPressable
      onPress={onPress}
      disabled={loading}
      animate={({ pressed }) => {
        'worklet';
        return {
          scale: pressed ? 0.96 : 1,
        };
      }}
    >
      <BlurView
        intensity={50}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={{ borderRadius: 999, overflow: 'hidden' }}
      >
        <View className={`rounded-full bg-primary-500/80 px-6 py-3 ${className || ''}`}>
          {loading ? (
            <ActivityIndicator color={colorScheme === 'dark' ? '#fff' : '#000'} />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              {label}
            </Text>
          )}
        </View>
      </BlurView>
    </MotiPressable>
  );
}


