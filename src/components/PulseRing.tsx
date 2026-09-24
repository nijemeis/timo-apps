import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme';

/**
 * Presence ping: scale .7 → 2.4, opacity .8 → 0, ease-out, infinite. `delay` staggers a second ring
 * (the onboarding uses two rings, 2.4 s, the second 1.2 s later).
 */
export function PulseRing({ size, duration = 2400, delay = 0, round = true, color = colors.accent500, style }: {
  size: number; duration?: number; delay?: number; round?: boolean; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const [started, setStarted] = useState(delay === 0);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const t = setTimeout(() => {
      setStarted(true);
      loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }));
      loop.start();
    }, delay);
    return () => { clearTimeout(t); loop?.stop(); };
  }, [v, duration, delay]);
  if (!started) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute', width: size, height: size, borderWidth: 1, borderColor: color, borderRadius: round ? size / 2 : 0,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.4] }) }],
        },
        style,
      ]}
    />
  );
}
