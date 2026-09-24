import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, isIOS, type } from '../theme';
import { Icon } from './Icon';

/**
 * Platform chrome. iOS: large title (36 condensed) on tab roots, or a 44pt bar with "‹ Back" + centred title.
 * Android: Material 3 top app bar, 64dp, arrow-left in a 48dp target, title 24/500.
 */
export function ScreenHeader({ title, back }: { title: string; back?: { label: string; onPress: () => void } }) {
  if (isIOS) {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        {back ? (
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Pressable onPress={back.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={back.label} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', marginLeft: -8, padding: 4, opacity: pressed ? 0.5 : 1 })}>
                <Icon icon={ChevronLeft} size={26} stroke={2} color={colors.accent700} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 17, color: colors.accent700 }}>{back.label}</Text>
              </Pressable>
            </View>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.text }}>{title}</Text>
            <View style={{ flex: 1 }} />
          </View>
        ) : (
          <Text accessibilityRole="header" style={[type.largeTitle, { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 4 }]}>{title}</Text>
        )}
      </View>
    );
  }
  return (
    <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 }}>
      {back ? (
        <Pressable onPress={back.onPress} accessibilityRole="button" accessibilityLabel={back.label} android_ripple={{ color: colors.hover, borderless: true, radius: 24 }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={ArrowLeft} size={24} />
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" numberOfLines={1} style={[type.androidTitle, { paddingHorizontal: 8 }]}>{title}</Text>
    </View>
  );
}
