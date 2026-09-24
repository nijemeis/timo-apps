import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Layers, MapPin, Plus, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/client';
import type { RegistrationDTO, RegistrationsResponse } from '../api/types';
import { Button, Chip, Icon, OfflineBar, ScreenHeader, Segmented, Tag } from '../components';
import { useLang, useT, type Dict } from '../i18n';
import { DEFAULT_TZ, formatDayHeader, formatDuration, formatRange, groupByDay, monthLabel, periodRange, type Period } from '../lib/format';
import { useNow } from '../lib/useNow';
import type { TabStackParamList } from '../navigation/types';
import { onPresence } from '../services/presence';
import { useSession } from '../services/session';
import { cacheRegs, noteApiResult } from '../state/ui';
import { colors, fonts, isIOS, type } from '../theme';

export function tagFor(r: RegistrationDTO, t: Dict): string | null {
  return r.status === 'auto' ? t.tagAuto : r.status === 'pending' ? t.tagPending : r.status === 'open' ? t.tagOpen : null;
}

/** Counted time, advanced for a running registration since the response arrived. */
export const liveMs = (r: RegistrationDTO, fetchedAt: number, now: number) => (r.status === 'open' && !r.checkOutAt ? r.countedMs + Math.max(0, now - fetchedAt) : r.countedMs);

/** 09 Registrations */
export function RegistrationsScreen({ navigation, route }: NativeStackScreenProps<TabStackParamList, 'Registrations'>) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const tz = me?.company?.timezone ?? DEFAULT_TZ;
  const [period, setPeriod] = useState<Period>('week');
  const [loc, setLoc] = useState<string | null>(null);
  const [attn, setAttn] = useState(false);
  const [data, setData] = useState<{ res: RegistrationsResponse; at: number } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(30_000);
  const reqId = useRef(0);

  // "Missing a registration?" on Home opens this tab with the Needs-attention filter on.
  useEffect(() => {
    if (route.params?.attention) {
      setAttn(true);
      navigation.setParams({ attention: undefined });
    }
  }, [route.params?.attention, navigation]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const [from, to] = periodRange(period, Date.now(), tz);
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (loc) q.set('location', loc);
    if (attn) q.set('attention', '1');
    setState((s) => (s === 'error' ? 'loading' : s));
    try {
      const res = await api<RegistrationsResponse>(`/api/me/registrations?${q.toString()}`);
      if (id !== reqId.current) return;
      cacheRegs(res.items);
      noteApiResult();
      setData({ res, at: Date.now() });
      setState('idle');
    } catch (e) {
      if (id !== reqId.current) return;
      noteApiResult(e);
      setState('error');
    }
  }, [period, loc, attn, tz]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => onPresence(() => { setTimeout(load, 2500); }), [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const items = data?.res.items ?? [];
  const at = data?.at ?? now;
  const total = (data?.res.totalMs ?? 0) + items.filter((r) => r.status === 'open' && !r.checkOutAt).reduce((a) => a + Math.max(0, now - at), 0);
  const groups = groupByDay(items, tz);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {isIOS ? null : <ScreenHeader title={t.regs} />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        {isIOS ? <ScreenHeader title={t.regs} /> : null}
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[{ key: 'week', label: t.pWeek }, { key: 'last', label: t.pLast }, { key: 'month', label: monthLabel(now, lang, tz) }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            <Chip label={t.allLocs} icon={Layers} on={loc === null} onPress={() => setLoc(null)} />
            {(me?.locations ?? []).map((l) => (
              <Chip key={l.id} label={l.name} icon={MapPin} on={loc === l.id} onPress={() => setLoc(l.id)} />
            ))}
            <Chip label={t.attention} icon={TriangleAlert} on={attn} onPress={() => setAttn(!attn)} />
          </ScrollView>
          <OfflineBar />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4, paddingBottom: 2 }}>
            <Text style={{ fontFamily: fonts.condSemibold, fontSize: 30, lineHeight: 36, color: colors.text, ...type.tnum }}>{formatDuration(total, lang)}</Text>
            {state === 'loading' && !data ? <ActivityIndicator color={colors.accent} /> : <Text style={type.secondary}>{t.count(items.length)}</Text>}
          </View>
          {data && !groups.length ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: 24 }}>{t.empty}</Text> : null}
          {!data && state === 'error' ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: 24 }}>{t.loadFailed}</Text> : null}
          {groups.map((g) => {
            const dayMs = g.items.reduce((a, r) => a + liveMs(r, at, now), 0);
            return (
              <View key={g.key}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.text }}>
                  <Text style={s.dayHead}>{formatDayHeader(g.first.checkInAt, lang, g.first.timezone || tz)}</Text>
                  <Text style={[s.dayHead, type.tnum]}>{formatDuration(dayMs, lang)}</Text>
                </View>
                {g.items.map((r) => {
                  const tag = tagFor(r, t);
                  return (
                    <Pressable key={r.id} onPress={() => navigation.navigate('Detail', { id: r.id })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: pressed ? colors.rowPressed : 'transparent' })}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={type.rowTime}>{formatRange(r.checkInAt, r.checkOutAt, r.timezone, t.running)}</Text>
                        <Text numberOfLines={1} style={type.secondary}>{[r.location, r.spot].filter(Boolean).join(' · ') || '—'}</Text>
                        {tag ? <Tag label={tag} style={{ marginTop: 4 }} /> : null}
                      </View>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text, ...type.tnum }}>{r.status === 'auto' ? '—' : formatDuration(liveMs(r, at, now), lang)}</Text>
                      <Icon icon={ChevronRight} size={18} color={colors.neutral500} />
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
          {attn && me?.company ? (
            <Button variant="secondary" height={48} fontSize={18} icon={Plus} label={t.reportMissing} onPress={() => navigation.navigate('Correction', { missing: true })} style={{ marginTop: 8 }} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = {
  dayHead: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.96, textTransform: 'uppercase', color: colors.muted } as const,
};
