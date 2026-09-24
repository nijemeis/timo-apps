import { Bell, Bluetooth, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueprintCard, Button, Icon, Kicker, PulseRing } from '../components';
import { useT } from '../i18n';
import { requestBatteryExemption, requestPermission, syncPresence } from '../services/presence';
import { setOnboarded } from '../services/session';
import { colors, fonts } from '../theme';

const STEPS = [
  { kind: 'bluetooth', icon: Bluetooth },
  { kind: 'location', icon: MapPin },
  { kind: 'notifications', icon: Bell },
] as const;

/** 04 Onboarding — three permission steps; "Continue" triggers the real OS prompt. */
export function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const cur = STEPS[step];

  const next = async () => {
    if (step < 2) { setStep(step + 1); return; }
    await setOnboarded();
    void syncPresence();
  };

  const cont = async () => {
    setBusy(true);
    try {
      const p = await requestPermission(cur.kind);
      // Android: after "Allow all the time", offer the battery-optimisation exemption so the service survives.
      if (Platform.OS === 'android' && cur.kind === 'location' && p && !p.batteryUnrestricted) await requestBatteryExemption();
    } catch {
      // A failed prompt shouldn't trap the user in setup; Home shows what's missing.
    } finally {
      setBusy(false);
    }
    await next();
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg, paddingTop: insets.top + 28, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kicker>{t.setup} · {step + 1}/3</Kicker>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {STEPS.map((_, i) => <View key={i} style={{ width: 28, height: 3, backgroundColor: i <= step ? colors.accent : colors.neutral300 }} />)}
        </View>
      </View>
      <BlueprintCard style={{ height: 210, alignItems: 'center', justifyContent: 'center' }}>
        <PulseRing key={`a${step}`} size={64} duration={2400} />
        <PulseRing key={`b${step}`} size={64} duration={2400} delay={1200} />
        <View style={{ width: 64, height: 64, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={cur.icon} size={30} color={colors.accent700} />
        </View>
      </BlueprintCard>
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.condSemibold, fontSize: 34, lineHeight: 37, color: colors.text }}>{t.perms[step].title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted }}>{t.perms[step].body}</Text>
      </View>
      <View style={{ marginTop: 'auto', gap: 8 }}>
        <Button label={t.cont} onPress={cont} loading={busy} />
        <Button variant="ghost" label={t.later} onPress={next} disabled={busy} />
      </View>
    </ScrollView>
  );
}
