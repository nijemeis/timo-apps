import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** 34h filter chip; selected = accent-200 fill, accent border, accent-800 text. */
export function Chip({ label, icon, on, onPress }: { label: string; icon?: LucideIcon; on: boolean; onPress: () => void }) {
  const fg = on ? colors.accent800 : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        height: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderRadius: 4, borderColor: on ? colors.accent : colors.divider,
        backgroundColor: on ? colors.accent200 : pressed ? colors.hover : 'transparent',
      })}
    >
      {icon ? <Icon icon={icon} size={15} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}
