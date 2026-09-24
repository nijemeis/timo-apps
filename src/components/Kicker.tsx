import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { type } from '../theme';

/** 12px uppercase label with +0.08em tracking. */
export function Kicker({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.kicker, style]}>{children}</Text>;
}
