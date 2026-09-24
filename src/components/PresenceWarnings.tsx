import { BatteryWarning, BellOff, BluetoothOff, MapPinOff, TriangleAlert } from 'lucide-react-native';
import { Platform, View } from 'react-native';

import { useT } from '../i18n';
import { trackingIssues, type TrackIssue } from '../lib/tracking';
import { openSettings, requestBatteryExemption, requestPermission, syncPresence, usePresence } from '../services/presence';
import { Notice } from './Notice';

/**
 * Persistent warnings for denied / not-Always permissions, Bluetooth off and (Android) battery
 * optimisation, each with the action that fixes it. Not designed in the handoff — built from the info box.
 */
export function PresenceWarnings({ include = ['location', 'bluetooth', 'bluetoothOff', 'battery'] }: { include?: TrackIssue['kind'][] }) {
  const t = useT();
  const permissions = usePresence((s) => s.permissions);
  const available = usePresence((s) => s.available);
  const issues = trackingIssues(permissions, { available }).filter((i) => include.includes(i.kind));
  if (!issues.length) return null;

  const ask = (kind: 'bluetooth' | 'location' | 'notifications') => async () => {
    await requestPermission(kind);
    void syncPresence();
  };

  const perm = issues.filter((i) => i.kind === 'location' || i.kind === 'bluetooth');
  const lines = perm.map((i) =>
    i.kind === 'location'
      ? i.state === 'whenInUse' ? (Platform.OS === 'android' ? t.warnLocationAlwaysAndroid : t.warnLocationAlways) : i.state === 'denied' ? t.warnLocationDenied : t.warnUndetermined
      : i.state === 'denied' ? t.warnBluetoothDenied : t.warnUndetermined,
  );
  const undetermined = perm.find((i) => (i.kind === 'location' || i.kind === 'bluetooth') && i.state === 'undetermined');

  return (
    <View style={{ gap: 10 }}>
      {perm.length ? (
        <Notice
          tone="warn"
          icon={perm[0].kind === 'location' ? MapPinOff : TriangleAlert}
          title={t.warnTitle}
          action={undetermined
            ? { label: t.allow, onPress: ask(undetermined.kind as 'bluetooth' | 'location') }
            : { label: t.openSettings, onPress: () => void openSettings() }}
        >
          {[...new Set(lines)].join(' ')}
        </Notice>
      ) : null}
      {issues.some((i) => i.kind === 'bluetoothOff') ? (
        <Notice tone="warn" icon={BluetoothOff} title={t.warnBluetoothOffTitle}>{t.warnBluetoothOff}</Notice>
      ) : null}
      {issues.some((i) => i.kind === 'battery') ? (
        <Notice icon={BatteryWarning} title={t.warnBatteryTitle} action={{ label: t.allow, onPress: () => void requestBatteryExemption() }}>{t.warnBattery}</Notice>
      ) : null}
      {issues.some((i) => i.kind === 'notifications') ? (
        <Notice icon={BellOff} action={{ label: t.openSettings, onPress: () => void openSettings() }}>{t.warnNotifications}</Notice>
      ) : null}
    </View>
  );
}
