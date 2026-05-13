import * as React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Image, View } from '@/components/ui';

type Props = {
  uri?: string;
  name: string;
  size?: number;
};

export function AvatarGradient({ uri, name, size = 40 }: Props): JSX.Element {
  const strokeWidth = 3;
  const outer = size;
  const inner = size - strokeWidth * 2;
  const radius = outer / 2 - strokeWidth / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Avatar of ${name}`}
      style={{ width: outer, height: outer }}
    >
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDE047" />
            <Stop offset="1" stopColor="#F97316" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke="url(#avatarGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
      </Svg>

      <View
        className="items-center justify-center overflow-hidden rounded-full bg-white/10"
        style={{
          width: inner,
          height: inner,
          margin: strokeWidth,
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: inner, height: inner }}
            contentFit="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-white/10">
            {/* fallback */}
          </View>
        )}
      </View>
    </View>
  );
}


