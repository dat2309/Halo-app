import { useRouter } from 'expo-router';
import React from 'react';

import { Cover } from '@/components/cover';
import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { translate } from '@/lib';
import { useIsFirstTime } from '@/lib/hooks';

export default function Onboarding() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();

  const goTo = (path: '/register' | '/login') => {
    setIsFirstTime(false);
    router.replace(path);
  };

  return (
    <View className="flex h-full items-center  justify-center">
      <FocusAwareStatusBar />
      <View className="w-full flex-1">
        <Cover />
      </View>
      <View className="justify-end ">
        <Text className="my-3 text-center text-5xl font-bold text-yellow-400">
          Halo
        </Text>
        <Text className="mb-2 text-center text-lg text-gray-600">
          Connect with friends, share moments
        </Text>

        <Text className="my-1 pt-6 text-left text-lg">
          Share photos & videos with friends
        </Text>
        <Text className="my-1 text-left text-lg">
          Track your calendar & finances
        </Text>
        <Text className="my-1 text-left text-lg">
          Real-time reactions & comments
        </Text>
        <Text className="my-1 text-left text-lg">
          Beautiful Glass UI design
        </Text>
      </View>
      <SafeAreaView className="mt-6 w-full px-6">
        <Button
          label={translate('auth.create_account')}
          onPress={() => goTo('/register')}
          testID="onboarding-create-account"
        />
        <View className="mt-3">
          <Button
            label={translate('auth.sign_in')}
            variant="outline"
            onPress={() => goTo('/login')}
            testID="onboarding-sign-in"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
