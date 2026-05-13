import React, { useEffect, useState } from 'react';
import { MotiView } from 'moti';
import { View } from '@/components/ui';

type Heart = {
    id: number;
    left: number;
    size: number;
    duration: number;
    delay: number;
};

type Props = {
    triggerCount: number;
    isVisible: boolean;
};

export function FloatingHearts({ triggerCount, isVisible }: Props) {
    const [hearts, setHearts] = useState<Heart[]>([]);

    useEffect(() => {
        if (!isVisible && hearts.length > 0) {
            setHearts([]);
        }
    }, [isVisible]);

    useEffect(() => {
        if (triggerCount > 0) {
            const newHearts = Array.from({ length: 8 }).map((_, i) => ({
                id: Date.now() + i,
                left: Math.random() * 80 + 10,
                size: Math.random() * 12 + 18, // Slightly smaller for more "explosive" feel
                duration: 400 + Math.random() * 300,
                delay: i * 30, // Tighter burst
            }));

            setHearts((prev) => [...prev, ...newHearts].slice(-20)); // Buffer more hearts if clicked rapidly

            const timer = setTimeout(() => {
                setHearts((prev) => prev.filter((h) => !newHearts.find((nh) => nh.id === h.id)));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [triggerCount]);

    return (
        <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
            {hearts.map((heart) => (
                <MotiView
                    key={heart.id}
                    from={{
                        translateY: 0,
                        opacity: 1,
                        scale: 0,
                        rotate: '0deg'
                    }}
                    animate={{
                        translateY: -300,
                        opacity: 0,
                        scale: 1.5,
                        rotate: Math.random() > 0.5 ? '45deg' : '-45deg'
                    }}
                    transition={{
                        type: 'timing',
                        duration: heart.duration,
                        delay: heart.delay,
                    }}
                    style={{
                        position: 'absolute',
                        bottom: 50,
                        left: `${heart.left}%`,
                    }}
                >
                    <View style={{ width: heart.size, height: heart.size }}>
                        <ViewEngineHeart color="#ff4b4b" />
                    </View>
                </MotiView>
            ))}
        </View>
    );
}

function ViewEngineHeart({ color }: { color: string }) {
    // Simple Heart Emoji or SVG. SVG is better.
    return <View className="items-center justify-center">
        <HeartIcon color={color} size={30} />
    </View>;
}

// Inline Heart Icon to avoid extra imports if not needed, but we have lucide
import { Heart as LucideHeart } from 'lucide-react-native';

function HeartIcon({ color, size }: { color: string, size: number }) {
    return <LucideHeart color={color} fill={color} size={size} />;
}
