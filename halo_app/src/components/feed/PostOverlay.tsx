import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Text, View } from '@/components/ui';
import { formatTimeAgo } from '@/lib/time';

type Props = {
    username: string;
    avatarUrl: string;
    createdAt: string;
    caption?: string;
};

export function PostOverlay({ username, avatarUrl, createdAt, caption }: Props) {
    return (
        <>
            {/* Top Left: Avatar & Info */}
            <View className="absolute left-4 top-4 z-10 flex-row items-center">
                <LinearGradient
                    colors={['#FACC15', '#F97316']}
                    className="h-10 w-10 items-center justify-center rounded-full p-[2px]"
                    style={{ borderRadius: 20 }}
                >
                    <View className="h-full w-full overflow-hidden rounded-full bg-black">
                        <Image
                            source={{ uri: avatarUrl }}
                            className="h-full w-full"
                            contentFit="cover"
                        />
                    </View>
                </LinearGradient>

                <View className="ml-3">
                    <Text className="text-base font-bold text-white shadow-sm">
                        {username}
                    </Text>
                    <Text className="text-xs font-medium text-white/80 shadow-sm">
                        {formatTimeAgo(createdAt)}
                    </Text>
                </View>
            </View>

            {/* Bottom Center: Caption */}
            {caption && (
                <View className="absolute bottom-24 left-0 right-0 z-10 items-center px-4">
                    <View className="max-w-[90%] rounded-2xl bg-black/40 px-4 py-2 backdrop-blur-md">
                        <Text className="text-center text-sm font-medium leading-5 text-white">
                            {caption}
                        </Text>
                    </View>
                </View>
            )}
        </>
    );
}
