import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors, fonts } from '../theme';

export type TagTone = 'ok' | 'info' | 'alert';

/** Status tags — the palette has no red/green/amber, so tone is carried by fill: ok · info · alert. */
export function Tag({ label, tone = 'info', style }: { label: string; tone?: TagTone; style?: StyleProp<TextStyle> }) {
  const t = tone === 'ok'
    ? { backgroundColor: colors.neutral200, borderColor: colors.divider, color: colors.text }
    : tone === 'alert'
      ? { backgroundColor: colors.accent900, borderColor: colors.accent900, color: colors.bg }
      : { backgroundColor: colors.accent100, borderColor: colors.accent, color: colors.accent700 };
  return (
    <Text style={[{ alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, overflow: 'hidden' }, t, style]}>
      {label}
    </Text>
  );
}
