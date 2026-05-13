import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { useAddPost, useUpload } from '@/api';
import { GlassContainer, GlassHeader } from '@/components/glass';
import {
  Button,
  ControlledInput,
  Text,
  showErrorMessage,
  View,
} from '@/components/ui';
import { translate } from '@/lib';

const schema = z.object({
  caption: z.string().optional().default(''),
  mediaUrl: z.string().min(1, 'Please select or upload a media file'),
  type: z.enum(['image', 'video']),
});

type FormType = z.infer<typeof schema>;

export default function AddPost() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mediaUrl?: string; type?: string }>();
  const { control, handleSubmit, setValue } = useForm<FormType>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: (params.type as FormType['type']) ?? 'image',
      mediaUrl: (params.mediaUrl as string) ?? '',
    },
  });
  const { mutate: addPost, isPending } = useAddPost();
  const { mutateAsync: upload, isPending: isUploading } = useUpload();

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 30,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mime = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
    try {
      const uploaded = await upload({
        uri: asset.uri,
        name: asset.fileName ?? 'upload',
        type: mime,
      });
      setValue('mediaUrl', uploaded.url);
      setValue('type', asset.type === 'video' ? 'video' : 'image');
      showMessage({
        message: translate('feed.upload_success'),
        type: 'success',
      });
    } catch (error) {
      showErrorMessage(translate('feed.upload_failed'));
    }
  };

  const onSubmit = (data: FormType) => {
    addPost(
      {
        type: data.type,
        mediaUrl: data.mediaUrl,
        caption: data.caption,
      },
      {
        onSuccess: () => {
          showMessage({
            message: translate('feed.post_success'),
            type: 'success',
          });
        },
        onError: () => {
          showErrorMessage(translate('feed.post_failed'));
        },
      }
    );
  };

  return (
    <GlassContainer>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <GlassHeader title="New post" />
      <View className="flex-1 p-4">
        <Text className="mb-3 text-white/70">
          Chọn ảnh/video hoặc nhập URL trực tiếp. (Sẽ thay bằng camera riêng ở
          bước sau.)
        </Text>
        <View className="mb-3 flex-row gap-2">
          <Button label="Pick media" onPress={pickMedia} loading={isUploading} />
          <Button
            label="Open camera"
            variant="outline"
            onPress={() => router.push('/camera')}
          />
        </View>
        <ControlledInput
          name="mediaUrl"
          label="Media URL"
          control={control}
        />
        <ControlledInput name="caption" label="Caption" control={control} />
        <Button
          label="Publish"
          loading={isPending}
          onPress={handleSubmit(onSubmit)}
          testID="add-post-button"
        />
      </View>
    </GlassContainer>
  );
}
