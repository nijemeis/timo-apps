import type { LucideIcon } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme';

/** Lucide at the design system's 1.5 stroke. */
export function Icon({ icon: I, size = 18, color = colors.text, stroke = 1.5, style }: {
  icon: LucideIcon; size?: number; color?: string; stroke?: number; style?: StyleProp<ViewStyle>;
}) {
  return <I size={size} color={color} strokeWidth={stroke} style={style} />;
}
