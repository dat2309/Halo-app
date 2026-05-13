import React from 'react';

import { View } from '@/components/ui';

type Props = {
  children: React.ReactNode;
};

export function GlassContainer({ children }: Props): React.JSX.Element {
  return (
    <View className="flex-1 bg-white dark:bg-black">
      {children}
    </View>
  );
}
