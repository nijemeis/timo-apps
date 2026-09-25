import { AppState } from 'react-native';
import { create } from 'zustand';

import TimoBeacons, {
  type NativeState,
  type NativeStrings,
  type PermissionState,
  type PresencePayload,
  type RangedBeacon,
} from '../../../modules/timo-beacons';
import { API_URL, api } from '../../api/client';
import type { BeaconConfig } from '../../api/types';
import { useSession, type Lang } from '../session';

/**
 * JS side of presence. The native pass-the-gate engine (modules/timo-beacons) decides check-in/check-out and keeps working
 * with the app closed; this service configures it from /api/me/beacon-config, mirrors its state for the UI,
 * relays foreground check-ins to the confirmation sheet and flushes the event queue while the app is open.
 */

interface PresenceStore {
  /** False when the native module is missing (Expo Go) — nothing is detected. */
  available: boolean;
  /** BLE hardware present (false on the iOS simulator / Android emulator). */
  bleAvailable: boolean;
  native: NativeState | null;
  permissions: PermissionState | null;
  config: BeaconConfig | null;
  nearby: RangedBeacon[];
  /** Latest foreground check-in/out, for the bottom sheet. Cleared by the UI. */
  confirm: PresencePayload | null;
}

export const usePresence = create<PresenceStore>(() => ({
  available: !!TimoBeacons,
  bleAvailable: false,
  native: null,
  permissions: null,
  config: null,
  nearby: [],
  confirm: null,
}));

const listeners = new Set<(e: PresencePayload) => void>();
/** Subscribe to check-in/out events (e.g. to refresh the home summary). Returns an unsubscribe. */
export function onPresence(fn: (e: PresencePayload) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const clearConfirm = () => usePresence.setState({ confirm: null });

export function notificationStrings(lang: Lang): NativeStrings {
  return lang === 'nl'
    ? {
        inTitle: 'Ingecheckt · {location}', inBody: 'Tijdregistratie gestart om {time} · {spot}',
        outTitle: 'Uitgecheckt · {location}', outBody: 'Geregistreerd {duration} · {spot}',
        hoursUnit: 'u', minutesUnit: 'm',
        serviceTitle: 'Timo is actief', serviceBody: 'Luistert naar Timo-beacons bij je werkplek',
      }
    : {
        inTitle: 'Checked in · {location}', inBody: 'Time registration started at {time} · {spot}',
        outTitle: 'Checked out · {location}', outBody: 'Registered {duration} · {spot}',
        hoursUnit: 'h', minutesUnit: 'm',
        serviceTitle: 'Timo is active', serviceBody: 'Listening for Timo beacons at your workplace',
      };
}

let subscribed = false;
function subscribe() {
  if (subscribed || !TimoBeacons) return;
  subscribed = true;
  TimoBeacons.addListener('onState', (s) => usePresence.setState({ native: s }));
  TimoBeacons.addListener('onRanged', (e) => usePresence.setState({ nearby: e.beacons }));
  TimoBeacons.addListener('onPresence', (e) => {
    if (e.foreground) usePresence.setState({ confirm: e });
    listeners.forEach((fn) => fn(e));
  });
  TimoBeacons.addListener('onError', (e) => console.warn('[timo-beacons]', e.message));
  AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      void refreshPermissions();
      void syncPresence();
    }
  });
}

export async function refreshPermissions(): Promise<PermissionState | null> {
  if (!TimoBeacons) return null;
  const permissions = await TimoBeacons.getPermissions();
  usePresence.setState({ permissions });
  return permissions;
}

export async function requestPermission(kind: 'bluetooth' | 'location' | 'notifications') {
  if (!TimoBeacons) return null;
  const permissions = await TimoBeacons.requestPermission(kind);
  usePresence.setState({ permissions });
  return permissions;
}

export const openSettings = () => TimoBeacons?.openSettings();
export const requestBatteryExemption = () => TimoBeacons?.requestBatteryExemption();

/** Everything granted that background detection needs. */
export function permissionsOk(p: PermissionState | null) {
  return !!p && p.location === 'always' && (p.bluetooth === 'granted' || p.bluetooth === 'unavailable');
}

/**
 * (Re)configure and start the engine for the signed-in user. Safe to call repeatedly: on sign-in, after
 * onboarding, when the app comes to the foreground and after the language or toggles change.
 */
export async function syncPresence() {
  subscribe();
  if (!TimoBeacons) return;
  const { status, token, deviceId, me, prefs, lang, onboarded } = useSession.getState();
  if (status !== 'signedIn' || !token || !deviceId || !onboarded) return;
  usePresence.setState({ bleAvailable: await TimoBeacons.isAvailable() });
  let config: BeaconConfig;
  try {
    config = await api<BeaconConfig>('/api/me/beacon-config');
  } catch {
    // Offline: the engine keeps running on its persisted config; just push what's queued later.
    usePresence.setState({ native: await TimoBeacons.getState() });
    return;
  }
  usePresence.setState({ config });
  if (!me?.company || config.major == null) {
    await TimoBeacons.stop();
    usePresence.setState({ native: await TimoBeacons.getState() });
    return;
  }
  await TimoBeacons.configure({
    uuid: config.uuid,
    major: config.major,
    beacons: config.beacons.map((b) => ({ minor: b.minor, locationId: b.locationId, location: b.location, spot: b.spot })),
    awaySeconds: config.awayMinutes * 60,
    lockSeconds: config.passLockMinutes * 60,
    serverOpen: config.open ? { minor: config.open.minor, since: Date.parse(config.open.checkInAt) } : null,
    apiUrl: API_URL,
    token,
    deviceId,
    sounds: prefs.sounds,
    notifications: prefs.notifications,
    strings: notificationStrings(lang),
  });
  const p = await refreshPermissions();
  if (p && p.location !== 'denied' && p.location !== 'undetermined') await TimoBeacons.start();
  usePresence.setState({ native: await TimoBeacons.flush() });
}

export async function flushPresence() {
  if (!TimoBeacons) return;
  usePresence.setState({ native: await TimoBeacons.flush() });
}

export async function setPresencePrefs(prefs: { sounds?: boolean; notifications?: boolean; lang?: Lang }) {
  if (!TimoBeacons) return;
  await TimoBeacons.setPreferences({
    sounds: prefs.sounds,
    notifications: prefs.notifications,
    ...(prefs.lang ? { strings: notificationStrings(prefs.lang) } : {}),
  });
}

export const startRanging = () => TimoBeacons?.startRanging();
export const stopRanging = () => { usePresence.setState({ nearby: [] }); return TimoBeacons?.stopRanging(); };

/** Dev/simulator only: drive the engine without BLE (the prototype's beacon simulator). */
export async function simulate(type: 'pass' | 'away', minor: number) {
  await TimoBeacons?.simulate(type, minor);
}

export async function resetPresence() {
  if (!TimoBeacons) return;
  await TimoBeacons.reset();
  usePresence.setState({ native: null, config: null, nearby: [], confirm: null });
}
