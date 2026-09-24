import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** Settings row: 52 min-height, top hairline, 20px accent-700 icon, 16px label, trailing value/control. */
export function ListRow({ icon, label, right, onPress, last, style, children }: {
  icon: LucideIcon; label?: string; right?: ReactNode; onPress?: () => void; last?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  const body = (
    <>
      <Icon icon={icon} size={20} color={colors.accent700} />
      {children ?? <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text }}>{label}</Text>}
      {right}
    </>
  );
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.divider, ...(last ? { borderBottomWidth: 1, borderBottomColor: colors.divider } : null) };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { backgroundColor: pressed ? colors.rowPressed : 'transparent' }, style]}>{body}</Pressable>
  ) : (
    <View style={[base, style]}>{body}</View>
  );
}

export function RowValue({ children, accent, mono }: { children: ReactNode; accent?: boolean; mono?: boolean }) {
  return (
    <Text numberOfLines={1} style={mono
      ? { fontFamily: fonts.mono, fontSize: 12, color: colors.muted }
      : accent ? { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent700 } : { fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>
      {children}
    </Text>
  );
}
