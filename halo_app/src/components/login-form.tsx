import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { Button, ControlledInput, Text, View } from '@/components/ui';

const loginSchema = z.object({
  identifier: z.string({
    required_error: 'Email or phone is required',
  }).min(1, 'Email or phone is required').refine(
    (val) => {
      const isEmail = z.string().email().safeParse(val).success;
      const isPhone = /^0\d{9}$/.test(val);
      return isEmail || isPhone;
    },
    { message: 'Must be a valid email or phone number (10 digits starting with 0)' }
  ),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).min(1, 'Name is required'),
  email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
  phone: z.string({ required_error: 'Phone is required' })
    .regex(/^0\d{9}$/, 'Phone must be 10 digits and start with 0'),
  username: z.string({ required_error: 'Username is required' })
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores allowed'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginFormType = z.infer<typeof loginSchema>;
export type RegisterFormType = z.infer<typeof registerSchema>;
export type FormType = LoginFormType & Partial<RegisterFormType>;

export type LoginFormProps = {
  onSubmit?: SubmitHandler<any>;
  variant?: 'login' | 'register';
};

export const LoginForm = ({
  onSubmit = () => { },
  variant = 'login',
}: LoginFormProps) => {
  const isRegister = variant === 'register';
  const { handleSubmit, control } = useForm({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={10}
    >
      <View className="flex-1 justify-center">
        <View className="items-center justify-center">
          <Text
            testID="form-title"
            className="pb-6 text-center text-4xl font-bold"
          >
            {isRegister ? 'Create account' : 'Sign in'}
          </Text>

          <Text className="mb-6 max-w-xs text-center text-gray-500">
            {isRegister
              ? 'Create an account to start using the app.'
              : 'Welcome back. Sign in to continue.'}
          </Text>
        </View>

        <View className="gap-4">
          {isRegister ? (
            <>
              <ControlledInput
                testID="name"
                control={control}
                name="name"
                label="Name"
              />
              <ControlledInput
                testID="email-input"
                control={control}
                name="email"
                label="Email"
              />
              <ControlledInput
                testID="phone-input"
                control={control}
                name="phone"
                label="Phone Number"
                placeholder="0123456789"
              />
              <ControlledInput
                testID="username-input"
                control={control}
                name="username"
                label="Username"
                placeholder="johndoe"
                autoCapitalize="none"
              />
            </>
          ) : (
            <ControlledInput
              testID="identifier-input"
              control={control}
              name="identifier"
              label="Email or Phone"
              placeholder="email@example.com or 0123456789"
            />
          )}


          <ControlledInput
            testID="password-input"
            control={control}
            name="password"
            label="Password"
            placeholder="***"
            secureTextEntry={true}
          />
          <Button
            testID="login-button"
            label={isRegister ? 'Register' : 'Login'}
            onPress={handleSubmit(onSubmit)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
