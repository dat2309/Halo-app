import * as React from 'react';

import { GlassCard, GlassContainer, GlassHeader } from '@/components/glass';
import { Pressable, Text, View } from '@/components/ui';

const tabs = {
  backend: 'Backend (NestJS)',
  mobile: 'Mobile (React Native)',
} as const;

type TabKey = keyof typeof tabs;

const backendCode = `// NestJS (demo)
@Controller('posts')
export class PostsController {
  @Get()
  findAll() {
    return { status: 200, message: 'OK', data: [] };
  }
}
`;

const mobileCode = `// React Native (demo)
export type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};
`;

export default function CodeScreen(): JSX.Element {
  const [tab, setTab] = React.useState<TabKey>('backend');
  const code = tab === 'backend' ? backendCode : mobileCode;

  return (
    <GlassContainer>
      <GlassHeader title="Code" />
      <View className="px-4">
        <View className="mb-4 flex-row gap-2">
          {(Object.keys(tabs) as TabKey[]).map((key) => {
            const isActive = key === tab;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                className={`rounded-full px-4 py-2 ${
                  isActive ? 'bg-yellow-300/20 border border-yellow-300/40' : 'bg-white/10'
                }`}
              >
                <Text className="text-sm text-white">{tabs[key]}</Text>
              </Pressable>
            );
          })}
        </View>

        <GlassCard className="p-4">
          <Text className="font-mono text-green-400">{code}</Text>
        </GlassCard>
      </View>
    </GlassContainer>
  );
}


