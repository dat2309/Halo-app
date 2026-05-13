import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import type { LoginFormProps } from '@/components/login-form';
import { LoginForm } from '@/components/login-form';
import { GlassContainer, GlassHeader } from '@/components/glass';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useLogin } from '@/api/auth';
import { translate, useAuth } from '@/lib';

export default function Login() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const { mutateAsync: login, isPending } = useLogin();

  const onSubmit: LoginFormProps['onSubmit'] = async (form) => {
    try {
      const response = await login({
        identifier: form.identifier || form.email || '',
        password: form.password,
      });

      if (response.status === 200) {
        signIn({
          access: response.data.accessToken,
          refresh: response.data.refreshToken,
        });
        router.replace('/');
      } else {
        showMessage({
          message: response.message ?? translate('auth.login_failed'),
          type: 'danger',
        });
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message || translate('auth.login_error');
      showMessage({
        message,
        type: 'danger',
      });
    }
  };

  return (
    <GlassContainer>
      <FocusAwareStatusBar />
      <View className="flex-1 pb-10">
        <GlassHeader title={translate('auth.welcome_back')} />
        <View className="flex-1 justify-center px-4">
          <LoginForm variant="login" onSubmit={onSubmit} />
        </View>
        <View className="flex-row items-center justify-center px-4 pt-2">
          <Text className="text-base text-white/80">
            {translate('auth.no_account')}{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/register')}
            accessibilityRole="link"
            testID="go-to-register"
            hitSlop={8}
          >
            <Text className="text-base font-bold text-yellow-400">
              {translate('auth.sign_up')}
            </Text>
          </Pressable>
        </View>
      </View>
    </GlassContainer>
  );
}
