import { BlurView } from 'expo-blur';
import React from 'react';
import { View, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle; // thêm prop style
};

import { useColorScheme } from 'nativewind';

export function GlassCard({ children, className, style }: Props) {
  const { colorScheme } = useColorScheme();

  return (
    <BlurView
      intensity={50}
      tint={colorScheme === 'dark' ? 'dark' : 'light'}
      style={{ borderRadius: 24, overflow: 'hidden', ...style }}
    >
      <View
        className={`rounded-3xl border border-black/5 dark:border-white/10 ${!className?.includes('bg-') ? 'bg-white/10 dark:bg-white/10' : ''
          } ${className ?? ''}`}
      >
        {children}
      </View>
    </BlurView>
  );
}
