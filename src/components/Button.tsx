import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';
import { Corners } from './Corners';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dashed';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  /** secondary: 50 (auth) or 48 (detail/profile); ghost: 44 or 42; defaults per variant */
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * primary — square accent fill with corner marks (pressed accent-700);
 * secondary — hairline, 4px radius, condensed label; ghost — accent-700 text only;
 * dashed — the prototype-only "demo: open the link" button.
 */
export function Button({ label, onPress, variant = 'primary', icon, height, fontSize, disabled, loading, style, compact }: Props) {
  const h = height ?? (variant === 'ghost' ? 44 : variant === 'dashed' ? 36 : 50);
  const fs = fontSize ?? (variant === 'ghost' ? 16 : variant === 'dashed' ? 13 : 19);
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        { height: h, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: compact ? 10 : 16 },
        variant === 'primary' && { backgroundColor: pressed ? colors.accent700 : colors.accent },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.divider, borderRadius: 4, backgroundColor: pressed ? colors.pressed : 'transparent' },
        variant === 'ghost' && { backgroundColor: pressed ? colors.ghostPressed : 'transparent' },
        variant === 'dashed' && { alignSelf: 'center', paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? colors.accent : colors.neutral500, borderRadius: 4 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.accent700} />
      ) : (
        <View style={s.row}>
          {icon ? <Icon icon={icon} size={variant === 'ghost' ? 18 : fs} color={fg(variant)} /> : null}
          <Text
            numberOfLines={1}
            style={[
              variant === 'primary' || variant === 'secondary'
                ? { fontFamily: fonts.condSemibold, fontSize: fs, letterSpacing: variant === 'primary' ? fs * 0.02 : 0 }
                : variant === 'ghost'
                  ? { fontFamily: fonts.semibold, fontSize: fs }
                  : { fontFamily: fonts.mono, fontSize: fs },
              { color: fg(variant) },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
      {variant === 'primary' ? <Corners /> : null}
    </Pressable>
  );
}

const fg = (v: Variant) => (v === 'primary' ? colors.bg : v === 'secondary' ? colors.text : v === 'ghost' ? colors.accent700 : colors.muted);

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
