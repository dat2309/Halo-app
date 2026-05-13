import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile, useUpdateProfile, useUpload } from '@/api';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from '@/components/ui';
import { resolveMediaUrl } from '@/lib/media-url';
import { translate, useAuth } from '@/lib';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signOut = useAuth((s) => s.signOut);

  const { data: profile, isPending, refetch } = useProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();
  const { mutateAsync: upload, isPending: isUploading } = useUpload();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState('');

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      const uploaded = await upload({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });

      updateProfile(
        { avatar: uploaded.url },
        {
          onSuccess: () => {
            refetch();
          },
          onError: () => {
            Alert.alert(
              translate('common.error'),
              translate('profile.update_avatar_failed')
            );
          },
        }
      );
    } catch {
      Alert.alert(
        translate('common.error'),
        translate('profile.upload_image_failed')
      );
    }
  };

  const handleSaveBio = () => {
    updateProfile(
      { bio: bio.trim() },
      {
        onSuccess: () => {
          setEditingBio(false);
          refetch();
        },
        onError: () => {
          Alert.alert(
            translate('common.error'),
            translate('profile.update_bio_failed')
          );
        },
      }
    );
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    updateProfile(
      { name: name.trim() },
      {
        onSuccess: () => {
          setEditingName(false);
          refetch();
        },
        onError: () => {
          Alert.alert(
            translate('common.error'),
            translate('profile.update_name_failed')
          );
        },
      }
    );
  };

  if (isPending) {
    return (
      <View className="flex-1 justify-center items-center">
        <FocusAwareStatusBar />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      >
        <View className="px-4">
          <View className="flex-row items-center mb-8">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-yellow-400 text-lg">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-extrabold text-yellow-400 ml-4">
              Profile
            </Text>
          </View>

          <View className="items-center mb-8">
            <TouchableOpacity onPress={handlePickAvatar} disabled={isUploading}>
              <View className="relative">
                <Image
                  source={{
                    uri: profile?.avatar
                      ? resolveMediaUrl(profile.avatar)
                      : undefined,
                  }}
                  className="h-28 w-28 rounded-full bg-neutral-200 dark:bg-neutral-700"
                  contentFit="cover"
                />
                {isUploading && (
                  <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
                    <ActivityIndicator />
                  </View>
                )}
              </View>
              <Text className="text-center text-sm text-yellow-400 mt-2">
                Change photo
              </Text>
            </TouchableOpacity>
          </View>

          <View className="gap-4">
            <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Name</Text>
              {editingName ? (
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <NameInput value={name} onChangeText={setName} />
                  </View>
                  <TouchableOpacity onPress={handleSaveName} disabled={isUpdating}>
                    <Text className="text-yellow-400 font-semibold">
                      {isUpdating ? '...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text className="text-neutral-400">Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setName(profile?.name ?? '');
                    setEditingName(true);
                  }}
                >
                  <Text className="text-gray-900 dark:text-white text-base">
                    {profile?.name || 'Tap to set name'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Bio</Text>
              {editingBio ? (
                <View className="gap-2">
                  <BioInput value={bio} onChangeText={setBio} />
                  <Text className="text-xs text-neutral-400 text-right">
                    {bio.length}/160
                  </Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={handleSaveBio} disabled={isUpdating}>
                      <Text className="text-yellow-400 font-semibold">
                        {isUpdating ? '...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingBio(false)}>
                      <Text className="text-neutral-400">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setBio(profile?.bio ?? '');
                    setEditingBio(true);
                  }}
                >
                  <Text className="text-gray-900 dark:text-white text-base">
                    {profile?.bio || 'Tap to add a bio'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Username</Text>
              <Text className="text-gray-900 dark:text-white text-base">
                @{profile?.username ?? '—'}
              </Text>
            </View>

            <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Email</Text>
              <Text className="text-gray-900 dark:text-white text-base">
                {profile?.email ?? '—'}
              </Text>
            </View>

            {profile?.phone ? (
              <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Phone</Text>
                <Text className="text-gray-900 dark:text-white text-base">{profile.phone}</Text>
              </View>
            ) : null}

            <View className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Member since
              </Text>
              <Text className="text-gray-900 dark:text-white text-base">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : '—'}
              </Text>
            </View>
          </View>

          <View className="mt-8">
            <Button
              label="Sign Out"
              onPress={() => {
                Alert.alert(
                  translate('profile.sign_out_title'),
                  translate('profile.sign_out_confirm'),
                  [
                    { text: translate('common.cancel'), style: 'cancel' },
                    {
                      text: translate('profile.sign_out_title'),
                      style: 'destructive',
                      onPress: signOut,
                    },
                  ]
                );
              }}
              variant="destructive"
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function BioInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { TextInput } = require('react-native');
  const { useColorScheme } = require('nativewind');
  const { colorScheme } = useColorScheme();
  return (
    <TextInput
      value={value}
      onChangeText={(t: string) => onChangeText(t.slice(0, 160))}
      autoFocus
      multiline
      style={{
        color: colorScheme === 'dark' ? 'white' : 'black',
        fontSize: 16,
        padding: 0,
        minHeight: 60,
      }}
      placeholderTextColor="#888"
      placeholder="Tell us about yourself..."
    />
  );
}

function NameInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { TextInput } = require('react-native');
  const { useColorScheme } = require('nativewind');
  const { colorScheme } = useColorScheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoFocus
      style={{
        color: colorScheme === 'dark' ? 'white' : 'black',
        fontSize: 16,
        padding: 0,
      }}
      placeholderTextColor="#888"
      placeholder="Enter your name"
    />
  );
}
