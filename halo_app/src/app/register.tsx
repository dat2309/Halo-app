import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import type { LoginFormProps } from '@/components/login-form';
import { LoginForm } from '@/components/login-form';
import { GlassContainer, GlassHeader } from '@/components/glass';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useRegister } from '@/api/auth';
import { translate, useAuth } from '@/lib';

export default function Register() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const { mutateAsync: register, isPending } = useRegister();

  const onSubmit: LoginFormProps['onSubmit'] = async (form) => {
    try {
      const response = await register({
        name: form.name || '',
        email: form.email || '',
        phone: form.phone || '',
        username: form.username || '',
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
          message: response.message ?? translate('auth.register_failed'),
          type: 'danger',
        });
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        translate('auth.register_error');
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
        <GlassHeader title={translate('auth.create_account')} />
        <View className="flex-1 justify-center px-4">
          <LoginForm variant="register" onSubmit={onSubmit} />
        </View>
        <View className="flex-row items-center justify-center px-4 pt-2">
          <Text className="text-base text-white/80">
            {translate('auth.have_account')}{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="link"
            testID="go-to-login"
            hitSlop={8}
          >
            <Text className="text-base font-bold text-yellow-400">
              {translate('auth.sign_in')}
            </Text>
          </Pressable>
        </View>
      </View>
    </GlassContainer>
  );
}
