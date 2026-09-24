import { LogIn, LogOut, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PresencePayload } from '../../../modules/timo-beacons';
import { Button, Corners, Icon, Kicker } from '../../components';
import { useLang, useT } from '../../i18n';
import { playChime } from '../../lib/chime';
import { DEFAULT_TZ, formatDuration, formatTime } from '../../lib/format';
import { clearConfirm, usePresence } from '../../services/presence';
import { useSession } from '../../services/session';
import { colors, fonts, type } from '../../theme';

const EASE = Easing.bezier(0.2, 0.9, 0.3, 1);
const AUTO_DISMISS_MS = 6000;

/**
 * 08 Check-in / check-out confirmation — bottom sheet (the chosen style). Shown for foreground presence
 * events; plays the chime (the native side stays silent in the foreground). Done, scrim tap, swipe down or 6 s.
 */
export function ConfirmSheet({ onRequestCorrection }: { onRequestCorrection: (c: PresencePayload) => void }) {
  const confirm = usePresence((s) => s.confirm);
  const [shown, setShown] = useState<PresencePayload | null>(null);
  const y = useRef(new Animated.Value(600)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const height = useRef(600);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sounds = useSession((s) => s.prefs.sounds);

  const close = useCallback((after?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.timing(y, { toValue: height.current, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShown(null);
      clearConfirm();
      after?.();
    });
  }, [y, scrim]);

  useEffect(() => {
    if (!confirm) return;
    setShown(confirm);
    if (sounds) void playChime(confirm.type);
    y.setValue(height.current);
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 350, easing: EASE, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => close(), AUTO_DISMISS_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { if (timer.current) clearTimeout(timer.current); },
    onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 80 || g.vy > 0.5) closeRef.current();
      else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
  })).current;
  const closeRef = useRef(() => close());
  closeRef.current = () => close();

  // Android back closes the sheet instead of navigating.
  useEffect(() => {
    if (!shown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [shown, close]);

  if (!shown) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => { height.current = e.nativeEvent.layout.height + 40; }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: y }] }}
      >
        <SheetBody c={shown} onDone={() => close()} onCorrect={() => close(() => onRequestCorrection(shown))} />
      </Animated.View>
    </View>
  );
}

function SheetBody({ c, onDone, onCorrect }: { c: PresencePayload; onDone: () => void; onCorrect: () => void }) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const tz = useSession((s) => s.me?.company?.timezone) ?? DEFAULT_TZ;
  const major = usePresence((s) => s.config?.major) ?? useSession.getState().me?.company?.major;
  const out = c.type === 'out';
  return (
    <View accessibilityViewIsModal style={{ backgroundColor: colors.bg, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 10, paddingHorizontal: 20, paddingBottom: Math.max(36, insets.bottom + 8), gap: 18 }}>
      <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.neutral400 }} />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={out ? LogOut : LogIn} size={28} color={colors.bg} />
          <Corners />
        </View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.condSemibold, fontSize: 30, lineHeight: 32, color: colors.text }}>{out ? t.cOut : t.cIn}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted }}>{out ? t.cOutBody : t.cInBody}</Text>
        </View>
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: colors.divider }}>
            <Kicker>{t.time}</Kicker>
            <Text style={s.big}>{formatTime(c.at, tz)}</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
            <Kicker>{out ? t.worked : t.beaconL}</Kicker>
            <Text style={s.big}>{out ? formatDuration(c.since != null ? c.at - c.since : 0, lang) : `${major ?? '—'}·${c.minor}`}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <Icon icon={MapPin} size={18} color={colors.accent700} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{c.location}</Text>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>{c.spot}</Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Button label={t.done} onPress={onDone} />
        <Button variant="ghost" height={42} fontSize={15} label={t.notRight} onPress={onCorrect} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  big: { fontFamily: fonts.condSemibold, fontSize: 30, lineHeight: 36, color: colors.text, ...type.tnum },
});
