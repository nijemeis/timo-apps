import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** Underlined accent-700 link (prototype <a>). */
export function TextLink({ label, onPress, icon, fontSize = 14, bold, style, textStyle }: {
  label: string; onPress: () => void; icon?: LucideIcon; fontSize?: number; bold?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 }, style]}>
      {icon ? <Icon icon={icon} size={16} color={colors.accent700} /> : null}
      <Text style={[{ fontFamily: bold ? fonts.semibold : fonts.regular, fontSize, color: colors.accent700, textDecorationLine: 'underline' }, textStyle]}>{label}</Text>
    </Pressable>
  );
}
