import { Bluetooth, ChevronDown, ChevronUp, LogIn, LogOut, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BlueprintCard, Button, Icon } from '../components';
import { useT } from '../i18n';
import { formatTime, shortUuid } from '../lib/format';
import { flushPresence, simulate, usePresence } from '../services/presence';
import { colors, fonts } from '../theme';

/**
 * __DEV__ only: the prototype's beacon simulator, driving the native engine without BLE
 * (the iOS simulator / Android emulator have no Bluetooth).
 */
export function DevSimulator() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { available, config, native, permissions } = usePresence();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    try { await fn(); } catch (e) { console.warn('[sim]', e); } finally { setBusy(null); }
  };

  const mono = { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.neutral800 } as const;

  return (
    <BlueprintCard style={{ padding: 14, gap: 12 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon icon={Bluetooth} size={18} color={colors.accent700} />
            <Text style={{ fontFamily: fonts.condSemibold, fontSize: 18, color: colors.text }}>{t.simTitle}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.subtle }}>DEV</Text>
          </View>
          {config ? <Text style={[mono, { color: colors.muted }]}>UUID {shortUuid(config.uuid)} · major {config.major ?? '—'}</Text> : null}
        </View>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color={colors.neutral500} />
      </Pressable>
      {open ? (
        <>
          {!available ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.accent700 }}>{t.simNoModule}</Text> : null}
          {available && !config?.beacons.length ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.accent700 }}>{t.simNoBeacons}</Text> : null}
          <View>
            {config?.beacons.map((b) => {
              const here = native?.inside?.minor === b.minor;
              return (
                <View key={b.minor} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }}>{b.location}</Text>
                      {here ? <View style={{ width: 7, height: 7, backgroundColor: colors.accent }} /> : null}
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{b.spot} · <Text style={{ fontFamily: fonts.mono }}>minor {b.minor}</Text></Text>
                  </View>
                  <Button compact height={32} fontSize={13} icon={LogIn} label={t.walkIn} onPress={run(`in${b.minor}`, () => simulate('pass', b.minor))} loading={busy === `in${b.minor}`} />
                  <Button compact variant="secondary" height={32} fontSize={13} icon={LogOut} label={t.leave} onPress={run(`out${b.minor}`, () => simulate('away', b.minor))} loading={busy === `out${b.minor}`} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 }}>
            <Button compact variant="secondary" height={30} fontSize={12} icon={RefreshCw} label={t.simSync} onPress={run('sync', flushPresence)} loading={busy === 'sync'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={mono}>
                {native?.inside ? `checked in ${native.inside.minor} since ${formatTime(native.inside.since)}` : 'checked out'}
                {native?.lastPassAt ? ` · last pass ${formatTime(native.lastPassAt)}` : ''}
                {native?.awaySince ? ` · away since ${formatTime(native.awaySince)}` : ' · in range'}
              </Text>
              <Text style={mono}>{`configured ${native?.configured ? 'yes' : 'no'} · monitoring ${native?.monitoring ? 'yes' : 'no'} · queued ${native?.queued ?? 0}`}</Text>
              <Text style={mono}>{`last sync ${native?.lastSyncAt ? formatTime(native.lastSyncAt) : '—'}${native?.lastSyncError ? ` · error ${native.lastSyncError}` : ''}`}</Text>
              {permissions ? <Text style={[mono, { color: colors.subtle }]}>{`bt ${permissions.bluetooth} · loc ${permissions.location} · notif ${permissions.notifications}`}</Text> : null}
            </View>
          </View>
        </>
      ) : null}
    </BlueprintCard>
  );
}
