import { Pressable, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

/** Equal cells, hairline frame with 4px radius; the selected cell is filled text-colour. */
export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.divider, borderRadius: 4, overflow: 'hidden' }} accessibilityRole="tablist">
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1, height: 38, alignItems: 'center', justifyContent: 'center',
              borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.divider,
              backgroundColor: on ? colors.text : pressed ? colors.hover : 'transparent',
            })}
          >
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.bg : colors.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
