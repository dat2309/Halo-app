/* eslint-disable react/no-unstable-nested-components */
import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { requestCameraAndMicrophone } from '@/lib/permissions/request-camera';

import { Pressable, Text } from '@/components/ui';
import { Home as HomeIcon } from '@/components/ui/icons/home';
import {
  CalendarIcon,
  CameraIcon,
  CodeIcon,
  FinanceIcon,
} from '@/components/ui/icons/halo-icons';
import {
  Settings as SettingsIcon,
} from '@/components/ui/icons';
import { useAuth, useIsFirstTime } from '@/lib';
import { GlassBottomTab } from '@/components/glass';

export default function TabLayout() {
  const status = useAuth((s) => s.status);
  const [isFirstTime] = useIsFirstTime();
  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }
  }, [hideSplash, status]);

  // Request camera permissions when app opens (no-op on web)
  useEffect(() => {
    requestCameraAndMicrophone();
  }, []);

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }
  return (
    <Tabs tabBar={(props) => <GlassBottomTab {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} width={size} height={size} />,
          tabBarButtonTestID: 'home-tab',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} width={size} height={size} />,
          tabBarButtonTestID: 'calendar-tab',
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <CameraIcon color={color} width={size} height={size} />,
          tabBarButtonTestID: 'camera-tab',
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          title: 'Messages',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="call-history"
        options={{
          href: null,
          title: 'Call History',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <FinanceIcon color={color} width={size} height={size} />,
          tabBarButtonTestID: 'finance-tab',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} width={size} height={size} />,
          tabBarButtonTestID: 'settings-tab',
        }}
      />

      <Tabs.Screen
        name="friends"
        options={{
          href: null,
          title: 'Friends',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          href: null,
          title: 'Search',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="dev"
        options={{
          href: null, // Hide from tab bar
          title: 'Dev Mode',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}


