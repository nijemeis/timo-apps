import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarRange, Clock, Info, MapPin } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '../api/client';
import type { CorrectionRequestBody, RegistrationDTO } from '../api/types';
import { Button, Chip, Field, Icon, Notice, ScreenHeader } from '../components';
import { useLang, useT, type Dict } from '../i18n';
import { addDays, dayKey, DEFAULT_TZ, formatDateLong, formatDayChip, formatRange, formatTime, maskTime, validateCorrection } from '../lib/format';
import type { TabStackParamList } from '../navigation/types';
import { useSession } from '../services/session';
import { cacheRegs, showToast, useCache } from '../state/ui';
import { colors, fonts, type } from '../theme';
import { useBackLabel } from './useBackLabel';

type Kind = CorrectionRequestBody['type'];

const errText = (code: string, t: Dict): string | null =>
  ({ time: t.errTime, out_before_in: t.errOrder, not_same_day: t.errSameDay, too_long: t.errLong, location: t.errLocation } as Record<string, string>)[code] ?? null;

/** 11 Request correction — for a registration, or (missing: true) for one that doesn't exist at all. */
export function CorrectionScreen({ navigation, route }: NativeStackScreenProps<TabStackParamList, 'Correction'>) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const backLabel = useBackLabel();
  const me = useSession((s) => s.me);
  const missingMode = !!route.params.missing || !route.params.id;
  const reg: RegistrationDTO | undefined = useCache((s) => (route.params.id ? s.regs[route.params.id] : undefined));
  const tz = reg?.timezone ?? me?.company?.timezone ?? DEFAULT_TZ;
  const isAuto = reg?.status === 'auto';

  const [kind, setKind] = useState<Kind>(missingMode ? 'missing' : isAuto ? 'forgot_checkout' : 'wrong_times');
  const [cin, setCin] = useState(reg ? formatTime(reg.checkInAt, tz) : '08:00');
  const [cout, setCout] = useState(reg && !isAuto && reg.checkOutAt ? formatTime(reg.checkOutAt, tz) : '17:30');
  const [note, setNote] = useState('');
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(Date.now(), -i, tz)), [tz]);
  const [day, setDay] = useState(() => dayKey(Date.now(), tz));
  const [locationId, setLocationId] = useState<string | null>(me?.locations.length === 1 ? me.locations[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = validateCorrection(cin, cout);
    if (v) { setError(errText(v, t)); return; }
    if (missingMode && (me?.locations.length ?? 0) > 0 && !locationId) { setError(t.errLocation); return; }
    setError(null); setBusy(true);
    const body: CorrectionRequestBody = { type: kind, checkIn: cin, checkOut: cout, note: note.trim() || null };
    try {
      if (missingMode) {
        await api('/api/corrections', { body: { ...body, type: 'missing', date: day, locationId } });
      } else {
        const updated = await api<RegistrationDTO>(`/api/registrations/${encodeURIComponent(route.params.id!)}/corrections`, { body });
        cacheRegs([updated]);
      }
      showToast(t.sent);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? (e.status === 0 ? t.offline : errText(e.code, t) ?? e.message) : String(e));
    } finally { setBusy(false); }
  };

  const types: [Kind, string][] = [['forgot_checkout', t.cForgot], ['wrong_times', t.cWrong], ['missing', t.cMissing]];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScreenHeader title={t.corrTitle} back={{ label: backLabel, onPress: () => navigation.goBack() }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 28, gap: 20 }}>
          {reg && !missingMode ? (
            <Text style={type.secondary}>{[formatDateLong(reg.checkInAt, lang, tz), formatRange(reg.checkInAt, reg.checkOutAt, tz, t.running), reg.location].filter(Boolean).join(' · ')}</Text>
          ) : null}

          {missingMode ? (
            <>
              <View style={{ gap: 8 }}>
                <Text style={type.label}>{t.day}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                  {days.map((d) => {
                    const k = dayKey(d, tz);
                    return <Chip key={k} icon={CalendarRange} label={formatDayChip(d, lang, tz)} on={day === k} onPress={() => setDay(k)} />;
                  })}
                </ScrollView>
              </View>
              {me?.locations.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={type.label}>{t.location}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {me.locations.map((l) => <Chip key={l.id} icon={MapPin} label={l.name} on={locationId === l.id} onPress={() => setLocationId(l.id)} />)}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={type.label}>{t.corrWhat}</Text>
              <View style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 4, overflow: 'hidden' }} accessibilityRole="radiogroup">
                {types.map(([k, label], i) => {
                  const on = kind === k;
                  return (
                    <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider, backgroundColor: pressed ? colors.rowPressed : 'transparent' })}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: on ? colors.accent : colors.neutral500, alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent }} /> : null}
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.text }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TimeField label={t.newIn} value={cin} onChange={(v) => { setCin(v); setError(null); }} />
            <TimeField label={t.newOut} value={cout} onChange={(v) => { setCout(v); setError(null); }} />
          </View>
          {error ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.accent800, marginTop: -8 }}>{error}</Text> : null}

          <Field label={t.note} value={note} onChangeText={setNote} placeholder={t.notePh} multiline maxLength={500} />
          <Notice tone="plain" icon={Info}>{t.corrInfo}</Notice>
          <Button label={t.submit} onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** HH:MM field — digits only, the colon is inserted while typing. */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field
      containerStyle={{ flex: 1 }}
      label={label}
      value={value}
      onChangeText={(v) => onChange(maskTime(v))}
      keyboardType="number-pad"
      maxLength={5}
      placeholder="00:00"
      selectTextOnFocus
      inputStyle={{ fontSize: 18, ...type.tnum }}
      right={<Icon icon={Clock} size={20} stroke={2} color={colors.text} style={{ marginRight: 14 }} />}
    />
  );
}
