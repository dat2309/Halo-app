import React from 'react';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from '@/components/ui';
import { Heart } from 'lucide-react-native';

type Props = {
    isLiked: boolean;
    onToggle: () => void;
    disabled?: boolean;
};

export function ReactionButton({ isLiked, onToggle, disabled }: Props) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onToggle();
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800/50"
        >
            <MotiView
                from={{ scale: 1 }}
                animate={{
                    scale: isLiked ? 1.2 : 1,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            >
                <Heart
                    size={22}
                    color={isLiked ? '#ff4b4b' : '#a1a1aa'}
                    fill={isLiked ? '#ff4b4b' : 'transparent'}
                />
            </MotiView>
        </Pressable>
    );
}
