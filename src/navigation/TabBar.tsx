import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CircleUser, House, ListChecks, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '../components';
import { useT } from '../i18n';
import { colors, fonts, isIOS } from '../theme';

const ICONS: Record<string, LucideIcon> = { HomeTab: House, RegsTab: ListChecks, ProfileTab: CircleUser };

/** Total height incl. the home indicator / gesture area — used to place the toast above it. */
export const tabBarHeight = (insets: EdgeInsets) => (isIOS ? 54 + Math.max(insets.bottom, 12) - 4 : 80 + Math.max(insets.bottom, 12));

/**
 * iOS: 84pt translucent-grey bar, 25pt icons, 11/600 labels, accent-700 when selected.
 * Android: Material 3 navigation bar, 64×32 pill (accent-200) behind the selected icon, 12pt labels.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const labels: Record<string, string> = { HomeTab: t.tabHome, RegsTab: t.tabRegs, ProfileTab: t.tabProfile };

  const press = (routeKey: string, name: string, focused: boolean) => {
    const e = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (e.defaultPrevented) return;
    if (focused) {
      // Re-tapping a tab pops its stack back to the root, as the platforms do.
      const route = state.routes.find((r) => r.key === routeKey);
      const nested = route?.state as { key?: string; index?: number } | undefined;
      if (nested?.key && (nested.index ?? 0) > 0) navigation.dispatch({ type: 'POP_TO_TOP', target: nested.key });
      return;
    }
    navigation.navigate(name);
  };

  if (isIOS) {
    return (
      <View style={{ flexDirection: 'row', paddingTop: 6, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 12) - 4, backgroundColor: 'rgba(233,233,234,.94)', borderTopWidth: 1, borderTopColor: colors.divider }}>
        {state.routes.map((r, i) => {
          const on = state.index === i;
          const fg = on ? colors.accent700 : colors.subtle;
          return (
            <Pressable key={r.key} onPress={() => press(r.key, r.name, on)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={labels[r.name]} style={{ flex: 1, height: 48, alignItems: 'center', gap: 3 }}>
              <Icon icon={ICONS[r.name]} size={25} color={fg} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: fg }}>{labels[r.name]}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', paddingTop: 12, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 12) + 16, backgroundColor: colors.surface }}>
      {state.routes.map((r, i) => {
        const on = state.index === i;
        return (
          <Pressable key={r.key} onPress={() => press(r.key, r.name, on)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={labels[r.name]} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent200 : 'transparent' }}>
              <Icon icon={ICONS[r.name]} size={22} color={on ? colors.accent800 : colors.neutral800} />
            </View>
            <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 12, color: colors.text }}>{labels[r.name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
