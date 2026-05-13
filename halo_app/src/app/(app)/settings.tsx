import { Env } from '@env';
import { useColorScheme } from 'nativewind';
import { Alert, Linking, Share as RNShare } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
import { ThemeItem } from '@/components/settings/theme-item';
import {
  colors,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Github, Rate, Share, Support, Website, Users } from '@/components/ui/icons';
import { translate, useAuth } from '@/lib';
import { useRouter } from 'expo-router';

// Fixed tab bar height (matches GlassBottomTab height)
const TAB_BAR_HEIGHT = 80;

export default function Settings() {
  const insets = useSafeAreaInsets();
  const contentPadding = TAB_BAR_HEIGHT + insets.bottom + 20;
  const router = useRouter();

  const signOut = useAuth((s) => s.signOut);
  const { colorScheme } = useColorScheme();
  const iconColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500];
  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView contentContainerStyle={{ paddingBottom: contentPadding }}>
        <View className="flex-1 px-4 pt-16">
          <Text className="text-2xl font-extrabold text-yellow-400 dark:text-yellow-400 mb-6">
            {translate('settings.title')}
          </Text>
          <ItemsContainer title="settings.generale">
            <Item
              text="Profile"
              icon={<Users color={iconColor} />}
              onPress={() => router.push('/profile')}
            />
            <Item
              text="chat.title"
              icon={<Users color={iconColor} />}
              onPress={() => router.push('/chat' as any)}
            />
            <Item
              text="call.history_title"
              icon={<Users color={iconColor} />}
              onPress={() => router.push('/call-history' as any)}
            />
            <LanguageItem />
            <ThemeItem />
            <Item
              text="Friends"
              icon={<Users color={iconColor} />}
              onPress={() => router.push('/friends')}
            />
          </ItemsContainer>

          <ItemsContainer title="settings.about">
            <Item text="settings.app_name" value={Env.NAME} />
            <Item text="settings.version" value={Env.VERSION} />
          </ItemsContainer>

          <ItemsContainer title="settings.support_us">
            <Item
              text="settings.share"
              icon={<Share color={iconColor} />}
              onPress={() => {
                RNShare.share({
                  message: 'Check out Halo App - Connect with friends, share moments!',
                });
              }}
            />
            <Item
              text="settings.rate"
              icon={<Rate color={iconColor} />}
              onPress={() => {
                Alert.alert(
                  translate('settings.rate_title'),
                  translate('settings.rate_message')
                );
              }}
            />
            <Item
              text="settings.support"
              icon={<Support color={iconColor} />}
              onPress={() => {
                Linking.openURL('mailto:support@haloapp.dev?subject=Halo%20App%20Support');
              }}
            />
          </ItemsContainer>

          <ItemsContainer title="settings.links">
            <Item text="settings.privacy" onPress={() => {
              Alert.alert(
                translate('settings.privacy_title'),
                translate('settings.privacy_message')
              );
            }} />
            <Item text="settings.terms" onPress={() => {
              Alert.alert(
                translate('settings.terms_title'),
                translate('settings.terms_message')
              );
            }} />
            <Item
              text="settings.github"
              icon={<Github color={iconColor} />}
              onPress={() => Linking.openURL('https://github.com')}
            />
            <Item
              text="settings.website"
              icon={<Website color={iconColor} />}
              onPress={() => Linking.openURL('https://haloapp.dev')}
            />
          </ItemsContainer>

          <View className="my-8">
            <ItemsContainer>
              <Item text="settings.logout" onPress={signOut} />
            </ItemsContainer>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
