import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

import { Text, View } from '@/components/ui';

type CategoryData = {
  category: string;
  amount: number;
};

type Props = {
  data: CategoryData[];
  size?: number;
};

const COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
];

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function CategoryPieChart({ data, size = 160 }: Props) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0 || data.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-gray-500 dark:text-white/50">
          No expense data for this month
        </Text>
      </View>
    );
  }

  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const strokeWidth = 24;

  // Build segments
  let accumulated = 0;
  const segments = data.map((d, i) => {
    const ratio = d.amount / total;
    const dashLength = ratio * circumference;
    const dashOffset = circumference - accumulated * circumference;
    accumulated += ratio;
    return {
      ...d,
      color: COLORS[i % COLORS.length],
      ratio,
      dashLength,
      dashOffset,
    };
  });

  return (
    <View className="items-center">
      <View className="relative" style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {segments.map((seg, i) => (
              <Circle
                key={`${seg.category}-${i}`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                strokeDashoffset={-seg.dashOffset + circumference}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View
          className="absolute items-center justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(total)}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-white/50">
            Total
          </Text>
        </View>
      </View>

      <View className="mt-4 w-full flex-row flex-wrap gap-x-4 gap-y-2 justify-center">
        {segments.map((seg, i) => (
          <View key={`${seg.category}-${i}`} className="flex-row items-center gap-2">
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <Text className="text-xs text-gray-700 dark:text-white/70">
              {seg.category} ({Math.round(seg.ratio * 100)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
