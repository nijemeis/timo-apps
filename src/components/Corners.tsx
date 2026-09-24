import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

/**
 * Blueprint "+" registration marks on the four corners of the parent (which must not clip).
 * Each mark is 11×11, two 1px lines, offset −6 so the cross sits on the parent's 1px border.
 */
export function Corners({ color = colors.corner }: { color?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <View key={c} style={[s.mark, c[0] === 't' ? { top: -6 } : { bottom: -6 }, c[1] === 'l' ? { left: -6 } : { right: -6 }]}>
          <View style={[s.v, { backgroundColor: color }]} />
          <View style={[s.h, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  mark: { position: 'absolute', width: 11, height: 11 },
  v: { position: 'absolute', left: 5, top: 0, width: 1, height: 11 },
  h: { position: 'absolute', top: 5, left: 0, width: 11, height: 1 },
});
