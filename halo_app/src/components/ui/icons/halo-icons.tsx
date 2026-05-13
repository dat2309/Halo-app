import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path, Rect, Circle, Polyline, Line } from 'react-native-svg';

export function CalendarIcon({ color = '#000', ...props }: SvgProps) {
    return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
            <Line x1={16} y1={2} x2={16} y2={6} />
            <Line x1={8} y1={2} x2={8} y2={6} />
            <Line x1={3} y1={10} x2={21} y2={10} />
        </Svg>
    );
}

export function FinanceIcon({ color = '#000', ...props }: SvgProps) {
    return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <Line x1={18} y1={20} x2={18} y2={10} />
            <Line x1={12} y1={20} x2={12} y2={4} />
            <Line x1={6} y1={20} x2={6} y2={14} />
        </Svg>
    );
}

export function CodeIcon({ color = '#000', ...props }: SvgProps) {
    return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <Polyline points="16 18 22 12 16 6" />
            <Polyline points="8 6 2 12 8 18" />
        </Svg>
    );
}

export function CameraIcon({ color = '#000', ...props }: SvgProps) {
    return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill={color} {...props}>
            <Path d="M9.828 5l-2 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.828l-2-2H9.828zM12 18a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        </Svg>
    );
}
