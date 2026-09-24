import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Hourglass, Info, LogIn, LogOut, PencilLine } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '../api/client';
import type { RegistrationDTO } from '../api/types';
import { BlueprintCard, Button, Icon, Kicker, Notice, OfflineBar, ScreenHeader, Tag } from '../components';
import { useLang, useT } from '../i18n';
import { formatDateLong, formatDuration, formatRange, formatTime, shortUuid } from '../lib/format';
import { useNow } from '../lib/useNow';
import type { TabStackParamList } from '../navigation/types';
import { usePresence } from '../services/presence';
import { cacheRegs, noteApiResult, useCache } from '../state/ui';
import { colors, fonts, type } from '../theme';
import { tagFor } from './RegistrationsScreen';
import { useBackLabel } from './useBackLabel';

/** Every Timo beacon broadcasts this proximity UUID (README → Beacon identity). */
export const TIMO_UUID = '5A4B0C1E-7F3D-4E2A-9B61-0D8C2E4F7A10';

/** 10 Registration detail */
export function RegistrationDetailScreen({ navigation, route }: NativeStackScreenProps<TabStackParamList, 'Detail'>) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const backLabel = useBackLabel();
  const { id } = route.params;
  const cached = useCache((s) => s.regs[id]);
  const uuid = usePresence((s) => s.config?.uuid) ?? TIMO_UUID;
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const r: RegistrationDTO | undefined = cached;
  const running = r?.status === 'open' && !r.checkOutAt;
  const now = useNow(1000, running);

  const load = useCallback(async () => {
    try {
      const reg = await api<RegistrationDTO>(`/api/registrations/${encodeURIComponent(id)}`);
      cacheRegs([reg]);
      setFetchedAt(Date.now());
      setError(null);
      noteApiResult();
    } catch (e) {
      noteApiResult(e);
      setError(e instanceof ApiError ? e : new ApiError(500, 'server', String(e)));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const header = <ScreenHeader title={t.detail} back={{ label: backLabel, onPress: () => navigation.goBack() }} />;

  if (!r) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        {header}
        <View style={{ padding: 20, gap: 16 }}>
          <OfflineBar />
          {error ? (
            <>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>{error.status === 0 ? t.offline : t.notFound}</Text>
              <Button variant="secondary" height={48} fontSize={18} label={t.retry} onPress={load} />
            </>
          ) : <ActivityIndicator color={colors.accent} />}
        </View>
      </View>
    );
  }

  const tag = tagFor(r, t);
  const durMs = r.status === 'auto' ? null : running ? r.countedMs + Math.max(0, now - fetchedAt) : r.checkOutAt ? Date.parse(r.checkOutAt) - Date.parse(r.checkInAt) : r.countedMs;
  const src = r.status === 'auto' ? t.srcAuto : running ? t.srcOpen : r.source === 'manual_correction' ? t.srcManual : r.source === 'admin' ? t.srcAdmin : t.srcBeacon;
  const changed = r.originalInAt && (r.originalInAt !== r.checkInAt || (r.originalOutAt ?? null) !== (r.checkOutAt ?? null));
  const pending = r.status === 'pending' || r.correction?.status === 'pending';
  const canRequest = !pending && !running;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 28, gap: 22 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        <OfflineBar />
        <View style={{ gap: 4 }}>
          <Kicker>{formatDateLong(r.checkInAt, lang, r.timezone)}</Kicker>
          <Text style={{ fontFamily: fonts.condMedium, fontSize: 60, lineHeight: 62, color: colors.text, ...type.tnum }}>{durMs == null ? '—' : formatDuration(durMs, lang)}</Text>
          {tag ? <Tag label={tag} style={{ marginTop: 6 }} /> : null}
        </View>

        <BlueprintCard style={{ paddingVertical: 16, paddingHorizontal: 18 }}>
          <TimeRow icon={LogIn} label={t.checkIn} value={formatTime(r.checkInAt, r.timezone)} />
          <View style={{ width: 24, height: 22, alignItems: 'center' }}><View style={{ width: 1, flex: 1, backgroundColor: colors.neutral500 }} /></View>
          <TimeRow icon={LogOut} label={t.checkOut} value={r.checkOutAt ? formatTime(r.checkOutAt, r.timezone) : '—'} />
        </BlueprintCard>

        <View>
          <DefRow label={t.location}>
            <Text style={s.defText}><Text style={{ fontFamily: fonts.semibold }}>{r.location ?? '—'}</Text>{r.spot ? `\n${r.spot}` : ''}</Text>
          </DefRow>
          <DefRow label={t.beacon}>
            {r.major != null && r.minor != null ? (
              <Text style={s.mono}>{`major ${r.major} · minor ${r.minor}\n`}<Text style={{ color: colors.muted }}>{shortUuid(uuid)}</Text></Text>
            ) : <Text style={s.defText}>—</Text>}
          </DefRow>
          {changed ? (
            <DefRow label={t.original}>
              <Text style={[s.defText, type.tnum]}>{formatRange(r.originalInAt!, r.originalOutAt, r.timezone, t.running)}</Text>
            </DefRow>
          ) : null}
          <DefRow label={t.source} last>
            <Text style={s.defText}>{src}</Text>
          </DefRow>
        </View>

        {pending ? <Notice icon={Hourglass}>{t.pendingNote}</Notice> : null}
        {!pending && r.correction?.status === 'declined' ? <Notice icon={Info}>{t.declinedNote}</Notice> : null}
        {canRequest ? (
          <Button variant="secondary" height={48} fontSize={18} icon={PencilLine} label={t.requestCorr} onPress={() => navigation.navigate('Correction', { id: r.id })} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function TimeRow({ icon, label, value }: { icon: typeof LogIn; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 24, alignItems: 'center' }}><Icon icon={icon} size={20} color={colors.accent700} /></View>
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}>{label}</Text>
      <Text style={{ fontFamily: fonts.condSemibold, fontSize: 24, color: colors.text, ...type.tnum }}>{value}</Text>
    </View>
  );
}

function DefRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider, ...(last ? { borderBottomWidth: 1, borderBottomColor: colors.divider } : null) }}>
      <Text style={{ width: 110, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted }}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const s = {
  defText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 21, color: colors.text },
} as const;
