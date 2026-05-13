import React from 'react';

import { Text, View } from '@/components/ui';

type Props = {
  title: string;
  right?: React.ReactNode;
  textColor?: string;
};

export function GlassHeader({ title, right, textColor = 'text-gray-900 dark:text-white' }: Props) {
  return (
    <View className="flex-row items-center justify-between px-6 pt-10 pb-4">
      <Text className={`text-2xl font-semibold ${textColor}`}>{title}</Text>
      <View>{right}</View>
    </View>
  );
}


