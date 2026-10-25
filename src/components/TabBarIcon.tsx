import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabBarIconName = 'home' | 'explore' | 'saved' | 'settings';

type Props = {
  name: TabBarIconName;
  color: string;
  size?: number;
};

/**
 * 下タブ用のシンプルな線画アイコン（公式ロゴは使わない）
 */
export function TabBarIcon({ name, color, size = 24 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
  };

  if (name === 'home') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Path
          d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'explore') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
        <Path
          d="M14.5 9.5l-1.2 4.3-4.3 1.2 1.2-4.3 4.3-1.2z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'saved') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Path
          d="M6 3h12v18l-6-4-6 4z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // settings: スライダー（絞り込み設定と対応）
  return (
    <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={8} cy={7} r={2.2} fill={color} stroke={color} strokeWidth={1} />
      <Circle cx={16} cy={12} r={2.2} fill={color} stroke={color} strokeWidth={1} />
      <Circle cx={10} cy={17} r={2.2} fill={color} stroke={color} strokeWidth={1} />
    </Svg>
  );
}
