import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Building2, ChevronRight, CircleHelp, MapPin, RadioTower } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '../api/client';
import type { RegistrationDTO, SummaryResponse } from '../api/types';
import { BlueprintCard, Button, Field, Icon, Kicker, OfflineBar, PresenceWarnings, PulseRing, TextLink } from '../components';
import { useLang, useT } from '../i18n';
import {
  DEFAULT_TZ, dayPart, firstName, formatDateLong, formatDuration, formatHours, formatRange, formatTime, formatTimer, startOfDay,
} from '../lib/format';
import { useNow } from '../lib/useNow';
import type { TabStackParamList } from '../navigation/types';
import { onPresence, syncPresence, usePresence } from '../services/presence';
import { joinCompany, useSession } from '../services/session';
import { cacheRegs, noteApiResult, showToast, useCache } from '../state/ui';
import { colors, fonts, type } from '../theme';

const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;

export async function loadSummary() {
  try {
    const s = await api<SummaryResponse>('/api/me/summary');
    useCache.setState({ summary: s, summaryAt: Date.now() });
    cacheRegs([s.open, ...s.today]);
    noteApiResult();
    return s;
  } catch (e) {
    noteApiResult(e);
    throw e;
  }
}

interface Live { since: number; location: string | null; spot: string | null; major: number | null; minor: number | null; tz: string; fromServer: boolean }

/** 06 Home — status variant. */
export function HomeScreen({ navigation }: NativeStackScreenProps<TabStackParamList, 'Home'>) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const { summary, summaryAt } = useCache();
  const native = usePresence((s) => s.native);
  const configMajor = usePresence((s) => s.config?.major ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const tz = me?.company?.timezone ?? DEFAULT_TZ;
  const now = useNow(30_000);

  const load = useCallback(async () => {
    try { await loadSummary(); setFailed(false); } catch { setFailed(true); }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]));

  // A check-in/out just happened: refresh now, and again once the native queue has had time to sync.
  useEffect(() => onPresence(() => { void load(); setTimeout(load, 2500); }), [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Live card: the server's open registration, unless the phone already left and hasn't synced that yet;
  // otherwise what the native engine says (offline check-in not yet on the server).
  const open = summary?.open ?? null;
  const unsyncedExit = !!(native?.configured && !native.inside && native.queued > 0);
  const live: Live | null = open && !unsyncedExit
    ? { since: Date.parse(open.checkInAt), location: open.location, spot: open.spot, major: open.major, minor: open.minor, tz: open.timezone, fromServer: true }
    : native?.inside
      ? { since: native.inside.since, location: native.inside.location, spot: native.inside.spot, major: configMajor ?? me?.company?.major ?? null, minor: native.inside.minor, tz, fromServer: false }
      : null;

  // Totals from the summary, advanced by the time elapsed since it was fetched while something runs.
  const elapsed = summary ? Math.max(0, now - summaryAt) : 0;
  const extra = live?.fromServer ? elapsed : live ? Math.max(0, now - Math.max(live.since, startOfDay(now, tz).getTime())) : 0;
  const todayMs = (summary?.todayMs ?? 0) + extra;
  const weekMs = (summary?.weekMs ?? 0) + extra;
  const contract = summary?.contractHours ?? me?.user.contractHours ?? 40;
  const pct = contract > 0 ? Math.min(100, (weekMs / (contract * 3600e3)) * 100) : 0;

  const hour = new Date(now).getHours();
  const name = firstName(me?.user.name);
  const greeting = `${t.greeting[dayPart(hour)]}${name ? `, ${name}` : ''}`;

  const openDetail = (r: RegistrationDTO) => navigation.navigate('Detail', { id: r.id });
  const goMissing = () => navigation.getParent()?.navigate('RegsTab', { screen: 'Registrations', params: { attention: true } });

  const noCompany = !!me && !me.company;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 28, gap: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 2 }}>
        <Kicker>{formatDateLong(now, lang, deviceTz())}</Kicker>
        <Text accessibilityRole="header" style={type.greeting}>{greeting}</Text>
      </View>

      <OfflineBar />
      {noCompany ? <JoinCompanyCard onJoined={load} /> : (
        <>
          <PresenceWarnings />
          <StatusCard live={live} />
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.divider }}>
            <View style={{ flex: 1, padding: 14, gap: 2, borderRightWidth: 1, borderRightColor: colors.divider }}>
              <Kicker>{t.today}</Kicker>
              <Text style={type.numeral}>{formatDuration(todayMs, lang)}</Text>
            </View>
            <View style={{ flex: 1, padding: 14, gap: 2 }}>
              <Kicker>{t.thisWeek}</Kicker>
              <Text style={type.numeral}>{formatDuration(weekMs, lang)}</Text>
              <View style={{ height: 3, backgroundColor: colors.neutral200, marginTop: 4 }}>
                <View style={{ height: 3, width: `${pct}%`, backgroundColor: colors.accent }} />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t.ofContract(formatHours(contract, lang))}</Text>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Kicker style={{ paddingBottom: 4 }}>{t.todayRegs}</Kicker>
            {summary && summary.today.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: 10 }}>{t.noneToday}</Text>
            ) : null}
            {!summary && failed ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: 10 }}>{t.loadFailed}</Text> : null}
            {summary?.today.map((r) => {
              const ms = r.status === 'auto' ? null : r.checkOutAt ? r.countedMs : r.countedMs + elapsed;
              return (
                <Pressable key={r.id} onPress={() => openDetail(r)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: pressed ? colors.rowPressed : 'transparent' })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type.rowTime}>{formatRange(r.checkInAt, r.checkOutAt, r.timezone, t.running)}</Text>
                    <Text numberOfLines={1} style={type.secondary}>{[r.location, r.spot].filter(Boolean).join(' · ') || '—'}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text, ...type.tnum }}>{ms == null ? '—' : formatDuration(ms, lang)}</Text>
                  <Icon icon={ChevronRight} size={18} color={colors.neutral500} />
                </Pressable>
              );
            })}
          </View>
          <TextLink icon={CircleHelp} label={t.missing} onPress={goMissing} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
    </ScrollView>
  );
}

/** Blueprint status card: live timer when checked in, radio-tower pulse when not. Ticks on its own. */
function StatusCard({ live }: { live: Live | null }) {
  const t = useT();
  const now = useNow(1000, !!live);
  const inside = !!live;
  const stateColor = inside ? colors.accent700 : colors.muted;
  return (
    <BlueprintCard style={{ padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, backgroundColor: stateColor }}>
            {inside ? <PulseRing size={8} duration={2000} round={false} color={colors.accent} /> : null}
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1.04, textTransform: 'uppercase', color: stateColor }}>{inside ? t.checkedIn : t.notIn}</Text>
        </View>
        {inside && live.major != null && live.minor != null ? (
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{`${live.major} · ${live.minor}`}</Text>
        ) : null}
      </View>
      {inside ? (
        <>
          <Text accessibilityRole="timer" style={type.hero} adjustsFontSizeToFit numberOfLines={1}>{formatTimer(now - live.since)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Icon icon={MapPin} size={18} color={colors.accent700} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.text }}>{live.location ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted }}>
                {[live.spot, `${t.since} ${formatTime(live.since, live.tz)}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 6 }}>
          <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <PulseRing size={40} duration={2600} />
            <Icon icon={RadioTower} size={26} color={colors.accent700} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted }}>{t.walkPast}</Text>
        </View>
      )}
    </BlueprintCard>
  );
}

/** Not designed yet: a user without a company joins with the self-registration code. */
function JoinCompanyCard({ onJoined }: { onJoined: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (code.trim().length < 3) { setError(t.joinUnknown); return; }
    setBusy(true); setError(null);
    try {
      const me = await joinCompany(code.trim().toUpperCase());
      showToast(t.joined(me.company?.name ?? ''));
      void syncPresence();
      onJoined();
    } catch (e) {
      setError(e instanceof ApiError ? (e.status === 0 ? t.offline : e.code === 'company_code' ? t.joinUnknown : e.message) : t.joinUnknown);
    } finally { setBusy(false); }
  };
  return (
    <BlueprintCard style={{ padding: 18, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={Building2} size={24} color={colors.accent700} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.condSemibold, fontSize: 26, lineHeight: 29, color: colors.text }}>{t.joinTitle}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted }}>{t.joinBody}</Text>
      <Field label={t.joinCode} value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }} placeholder="NP-1042" mono autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={join} error={error} />
      <Button label={t.joinButton} onPress={join} loading={busy} />
    </BlueprintCard>
  );
}
