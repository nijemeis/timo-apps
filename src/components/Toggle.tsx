import { Platform, Switch } from 'react-native';

import { colors } from '../theme';

/** Native switch in the design's colours: iOS 51×31 (off #d4d4d7), Material (off track #e7e7ea, thumb #7a7a7d). */
export function Toggle({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return Platform.OS === 'ios' ? (
    <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.neutral300, true: colors.accent }} ios_backgroundColor={colors.neutral300} thumbColor={colors.white} />
  ) : (
    <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.neutral200, true: colors.accent }} thumbColor={value ? colors.bg : colors.subtle} />
  );
}
