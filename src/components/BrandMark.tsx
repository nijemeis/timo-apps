import { Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { Corners } from './Corners';

/** Beacon glyph: 0.72em circle with a #749dc4 ring, a #d4d4d7 ring 0.24em outside it, a 0.26em accent square. */
export function BeaconGlyph({ em }: { em: number }) {
  const d = em * 0.72, o = em * 0.24, sq = em * 0.26;
  return (
    <View style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: -o, left: -o, width: d + 2 * o, height: d + 2 * o, borderRadius: (d + 2 * o) / 2, borderWidth: 1, borderColor: colors.neutral300 }} />
      <View style={{ position: 'absolute', top: 0, left: 0, width: d, height: d, borderRadius: d / 2, borderWidth: 1, borderColor: colors.accent500 }} />
      <View style={{ width: sq, height: sq, backgroundColor: colors.accent }} />
    </View>
  );
}

/** "TIMO" wordmark in a hairline box with corner marks. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: size * 0.45, paddingVertical: size / 3, paddingHorizontal: size * 0.533, borderWidth: 1, borderColor: colors.divider }}>
      <BeaconGlyph em={size} />
      <Text style={{ fontFamily: fonts.condSemibold, fontSize: size, lineHeight: size * 1.1, letterSpacing: size * 0.14, color: colors.text, marginRight: -size * 0.14 }}>TIMO</Text>
      <Corners />
    </View>
  );
}
