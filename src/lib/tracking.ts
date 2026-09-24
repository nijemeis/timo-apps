import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { PermissionState } from '../../modules/timo-beacons';
import type { MeResponse } from '../api/types';
import { permissionsOk } from '../services/presence';

export type TrackIssue =
  | { kind: 'location'; state: 'whenInUse' | 'denied' | 'undetermined' }
  | { kind: 'bluetooth'; state: 'denied' | 'undetermined' }
  | { kind: 'bluetoothOff' }
  | { kind: 'battery' }
  | { kind: 'notifications' };

/** What stands between this phone and automatic check-in, most important first. */
export function trackingIssues(p: PermissionState | null, opts: { available: boolean }): TrackIssue[] {
  if (!opts.available || !p) return [];
  const out: TrackIssue[] = [];
  if (p.location !== 'always') out.push({ kind: 'location', state: p.location });
  if (p.bluetooth === 'denied' || p.bluetooth === 'undetermined') out.push({ kind: 'bluetooth', state: p.bluetooth });
  // 'unavailable' is also what a simulator reports — only a real device can have Bluetooth switched off.
  if (p.bluetooth === 'unavailable' && Device.isDevice) out.push({ kind: 'bluetoothOff' });
  if (Platform.OS === 'android' && !p.batteryUnrestricted) out.push({ kind: 'battery' });
  if (p.notifications === 'denied') out.push({ kind: 'notifications' });
  return out;
}

export type TrackStatus = 'active' | 'needsPermission' | 'bluetoothOff' | 'noCompany' | 'unavailable' | 'paused';

export function trackingStatus(p: PermissionState | null, opts: { available: boolean; monitoring: boolean; me: MeResponse | null }): TrackStatus {
  if (!opts.available) return 'unavailable';
  if (opts.me && !opts.me.company) return 'noCompany';
  if (!permissionsOk(p)) return 'needsPermission';
  if (p?.bluetooth === 'unavailable' && Device.isDevice) return 'bluetoothOff';
  return opts.monitoring ? 'active' : 'paused';
}
