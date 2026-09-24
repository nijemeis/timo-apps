import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

import { useToast } from '../state/ui';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** Dark #1d1f20 bar with a check icon; sits 20pt above the tab bar. */
export function Toast({ bottom }: { bottom: number }) {
  const { message, id } = useToast();
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: message ? 1 : 0, duration: message ? 200 : 150, useNativeDriver: true }).start();
  }, [message, id, o]);
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom, zIndex: 20, opacity: o, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Icon icon={Check} size={18} color={colors.bg} />
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.bg }}>{message}</Text>
    </Animated.View>
  );
}
