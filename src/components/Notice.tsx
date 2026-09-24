import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/**
 * Info box (accent-100 fill, accent-300 border, accent-800 text) as on the detail screen's pending note.
 * `tone="warn"` is the stronger variant used for the not-yet-designed warnings: accent border and an
 * optional action; `tone="plain"` is the muted 13px icon+text line (correction info).
 */
export function Notice({ icon, title, children, action, tone = 'info', style }: {
  icon: LucideIcon; title?: string; children?: ReactNode; action?: { label: string; onPress: () => void } | null; tone?: 'info' | 'warn' | 'plain'; style?: StyleProp<ViewStyle>;
}) {
  if (tone === 'plain') {
    return (
      <View style={[{ flexDirection: 'row', gap: 8 }, style]}>
        <Icon icon={icon} size={16} color={colors.muted} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted }}>{children}</Text>
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', gap: 10, padding: 12, backgroundColor: colors.accent100, borderWidth: 1, borderColor: tone === 'warn' ? colors.accent : colors.accent300 }, style]}>
      <Icon icon={icon} size={18} color={colors.accent800} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.accent800 }}>{title}</Text> : null}
        {children ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.accent800 }}>{children}</Text> : null}
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 6, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.accent700, textDecorationLine: 'underline' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
