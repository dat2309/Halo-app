import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useColorScheme } from 'nativewind';

import { Pressable, Text, View } from '@/components/ui';

type Props = BottomTabBarProps;

export function GlassBottomTab({ state, descriptors, navigation }: Props) {
  const { colorScheme } = useColorScheme();

  // Tabs displayed in the bar (order matters)
  const VISIBLE_TABS = ['index', 'calendar', 'camera', 'finance', 'settings'];
  const tabs = VISIBLE_TABS
    .map((name) => state.routes.find((r) => r.name === name))
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Hide tab bar entirely when:
  //  - active route is camera (fullscreen UX)
  //  - active route opted out via setOptions({ tabBarStyle: { display: 'none' } })
  const currentRoute = state.routes[state.index];
  const currentOptions = descriptors[currentRoute.key]?.options as any;
  const currentTabBarStyle = currentOptions?.tabBarStyle;
  const hiddenByOption =
    currentTabBarStyle &&
    typeof currentTabBarStyle === 'object' &&
    (currentTabBarStyle as any).display === 'none';
  if (currentRoute.name === 'camera' || hiddenByOption) {
    return null;
  }

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50 overflow-visible">
      {/* Glass / Blur container */}
      <BlurView
        intensity={80}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        className=" border-t border-white/10 dark:border-white/10"
      >
        <View className="flex-row items-center justify-between px-2 h-20 pb-3 bg-white/40 dark:bg-black/60 overflow-visible">
          {tabs.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = state.routes[state.index].key === route.key;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const Icon = options.tabBarIcon;
            const isCamera = route.name === 'camera';

            const activeColor = '#FACC15'; // yellow-400
            const inactiveColor = '#9CA3AF'; // gray-400

            /* =========================
               CAMERA TAB (SPECIAL)
            ========================== */
            if (isCamera) {
              return (
                <View
                  key={route.key}
                  className="relative w-20 items-center justify-end -top-4 overflow-visible"
                >
                  <Pressable
                    onPress={onPress}
                    accessibilityRole="button"
                    accessibilityLabel="Open Camera"
                    className="h-16 w-16 items-center justify-center rounded-full bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.55)] active:scale-95"
                  >
                    {Icon ? (
                      <Icon size={30} color="#000" focused />
                    ) : null}
                  </Pressable>
                </View>
              );
            }

            /* =========================
               NORMAL TAB ITEM
            ========================== */
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                className="flex-1 items-center justify-center"
              >
                <MotiView
                  animate={{
                    scale: isFocused ? 1.1 : 1,
                  }}
                  transition={{
                    type: 'timing',
                    duration: 200,
                  }}
                  className="items-center"
                >
                  {Icon ? (
                    <Icon
                      size={24}
                      focused={isFocused}
                      color={isFocused ? activeColor : inactiveColor}
                    />
                  ) : null}

                  <Text
                    className={`mt-1 text-[10px] font-medium ${isFocused ? 'text-yellow-400' : 'text-gray-400'
                      }`}
                  >
                    {typeof options.tabBarLabel === 'string'
                      ? options.tabBarLabel
                      : typeof options.title === 'string'
                        ? options.title
                        : route.name}
                  </Text>
                </MotiView>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
