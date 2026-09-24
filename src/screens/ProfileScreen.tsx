import { useFocusEffect } from '@react-navigation/native';
import * as Application from 'expo-application';
import { Battery, Bell, BluetoothSearching, ChevronRight, Languages, Lock, LogOut, RadioTower, ShieldCheck, Volume2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueprintCard, Button, Icon, Kicker, ListRow, PresenceWarnings, RowValue, ScreenHeader, Toggle } from '../components';
import { useT } from '../i18n';
import { formatRanged, initials } from '../lib/format';
import { trackingStatus } from '../lib/tracking';
import {
  openSettings, permissionsOk, refreshPermissions, requestBatteryExemption, requestPermission, setPresencePrefs, startRanging, stopRanging, usePresence,
} from '../services/presence';
import { setPrefs, signOut, useSession, type Lang } from '../services/session';
import { colors, fonts, isIOS } from '../theme';
import { DevSimulator } from './DevSimulator';

/** 12 Profile and settings */
export function ProfileScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { me, prefs, lang } = useSession();
  const { available, permissions, native, nearby } = usePresence();

  useFocusEffect(useCallback(() => {
    void refreshPermissions();
    void startRanging();
    return () => { void stopRanging(); };
  }, []));

  const status = trackingStatus(permissions, { available, monitoring: !!native?.monitoring, me });
  const statusText = { active: t.active, needsPermission: t.needsPermission, bluetoothOff: t.bluetoothOffShort, noCompany: t.noCompanyShort, unavailable: t.unavailable, paused: t.paused }[status];

  const setSounds = async (v: boolean) => { await setPrefs({ sounds: v }); await setPresencePrefs({ sounds: v }); };
  const setNotifs = async (v: boolean) => {
    if (v && permissions?.notifications === 'undetermined') await requestPermission('notifications');
    else if (v && permissions?.notifications === 'denied') void openSettings();
    await setPrefs({ notifications: v });
    await setPresencePrefs({ notifications: v });
  };
  const toggleLang = async () => {
    const next: Lang = lang === 'en' ? 'nl' : 'en';
    await setPrefs({ lang: next });
    await setPresencePrefs({ lang: next });
  };

  const missing: string[] = [];
  if (permissions) {
    if (permissions.bluetooth === 'denied' || permissions.bluetooth === 'undetermined') missing.push(t.permBluetooth);
    if (permissions.location === 'whenInUse') missing.push(t.permLocationAlways);
    else if (permissions.location !== 'always') missing.push(t.permLocation);
    if (permissions.notifications !== 'granted') missing.push(t.permNotifications);
  }
  const allGranted = permissionsOk(permissions) && permissions?.notifications === 'granted';

  const strongest = [...nearby].sort((a, b) => b.rssi - a.rssi)[0];
  const nearbyText = strongest ? `${formatRanged(strongest)}${nearby.length > 1 ? ` +${nearby.length - 1}` : ''}` : '—';

  const confirmSignOut = () =>
    Alert.alert(t.signOutConfirm, t.signOutBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);

  const version = `Timo ${Application.nativeApplicationVersion ?? '1.0'} (${Application.nativeBuildVersion ?? '—'}) · ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`;
  const companyLine = me?.company ? [me.company.name, me.user.team].filter(Boolean).join(' · ') : t.noCompany;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {isIOS ? null : <ScreenHeader title={t.profile} />}
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {isIOS ? <ScreenHeader title={t.profile} /> : null}
        <View style={{ paddingHorizontal: 20, gap: 24 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <BlueprintCard style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.condSemibold, fontSize: 24, color: colors.accent700 }}>{initials(me?.user.name, me?.user.email)}</Text>
            </BlueprintCard>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text }}>{me?.user.name ?? ''}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted }}>{me?.user.email ?? ''}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accent700, marginTop: 2 }}>{companyLine}</Text>
            </View>
          </View>

          <PresenceWarnings />

          <View>
            <Kicker style={{ paddingBottom: 6 }}>{t.tracking}</Kicker>
            <ListRow icon={RadioTower} label={t.bgDetect} onPress={status === 'needsPermission' ? () => void openSettings() : undefined}
              right={<RowValue accent={status === 'active'}>{statusText}</RowValue>} />
            <ListRow icon={Volume2} label={t.sounds} right={<Toggle value={prefs.sounds} onValueChange={setSounds} />} />
            <ListRow icon={Bell} label={t.notifs} right={<Toggle value={prefs.notifications} onValueChange={setNotifs} />} />
            {Platform.OS === 'android' && permissions ? (
              <ListRow icon={Battery} label={t.battery} onPress={permissions.batteryUnrestricted ? undefined : () => void requestBatteryExemption()}
                right={<RowValue accent={!permissions.batteryUnrestricted}>{permissions.batteryUnrestricted ? t.batteryOff : t.batteryOn}</RowValue>} />
            ) : null}
            <ListRow icon={BluetoothSearching} label={t.nearby} last right={<RowValue mono>{nearbyText}</RowValue>} />
          </View>

          <View>
            <Kicker style={{ paddingBottom: 6 }}>{t.general}</Kicker>
            <ListRow icon={Languages} label={t.language} onPress={toggleLang}
              right={<><RowValue>{t.langName}</RowValue><Icon icon={ChevronRight} size={18} color={colors.neutral500} /></>} />
            <ListRow icon={ShieldCheck} label={t.permsLabel} onPress={allGranted || !permissions ? undefined : () => void openSettings()}
              right={allGranted || !permissions
                ? <RowValue>{permissions ? t.permsVal : '—'}</RowValue>
                : <><View style={{ flexShrink: 1, maxWidth: '55%' }}><RowValue accent>{missing.join(', ')}</RowValue></View><Icon icon={ChevronRight} size={18} color={colors.neutral500} /></>} />
            <ListRow icon={Lock} last style={{ alignItems: 'flex-start', paddingVertical: 14 }}>
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted }}>{t.privacyText}</Text>
            </ListRow>
          </View>

          <Button variant="secondary" height={48} fontSize={18} icon={LogOut} label={t.signOut} onPress={confirmSignOut} />
          {__DEV__ ? <DevSimulator /> : null}
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, textAlign: 'center' }}>{version}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
