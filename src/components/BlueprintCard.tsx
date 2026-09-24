import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme';
import { Corners } from './Corners';

/** Square, unfilled, hairline border, "+" corner marks. */
export function BlueprintCard({ children, style, cornerColor }: { children?: ReactNode; style?: StyleProp<ViewStyle>; cornerColor?: string }) {
  return (
    <View style={[{ borderWidth: 1, borderColor: colors.divider }, style]}>
      {children}
      <Corners color={cornerColor} />
    </View>
  );
}
