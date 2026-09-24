import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NativeConfig, NativeState, PermissionState, TimoBeaconsEvents } from './TimoBeacons.types';

declare class TimoBeaconsModule extends NativeModule<TimoBeaconsEvents> {
  /** False on simulators/emulators and devices without BLE. */
  isAvailable(): Promise<boolean>;
  getPermissions(): Promise<PermissionState>;
  /** Step-wise, as the onboarding asks: 'bluetooth' → 'location' (Always / all the time) → 'notifications'. */
  requestPermission(kind: 'bluetooth' | 'location' | 'notifications'): Promise<PermissionState>;
  /** Opens the OS settings page for Timo (for denied permissions). */
  openSettings(): Promise<void>;
  /** Android: asks to exempt Timo from battery optimisation. iOS: no-op. */
  requestBatteryExemption(): Promise<void>;
  /** Persist the configuration; survives app restarts so background wake-ups work without JS. */
  configure(config: NativeConfig): Promise<void>;
  /** Update only toggles/copy without touching state. */
  setPreferences(prefs: { sounds?: boolean; notifications?: boolean; strings?: NativeConfig['strings'] }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Stop, forget config, state and queue (sign out). */
  reset(): Promise<void>;
  getState(): Promise<NativeState>;
  /** Upload queued events now. Resolves with the new state. */
  flush(): Promise<NativeState>;
  /** Foreground ranging for the "Nearby beacons" row. */
  startRanging(): Promise<void>;
  stopRanging(): Promise<void>;
  /** Drive the engine as if a beacon was seen/lost — the simulator has no BLE (dev builds only in the UI). */
  simulate(type: 'enter' | 'exit', minor: number): Promise<void>;
}

/** Null when the native module isn't linked (e.g. Expo Go) — the presence service then runs in mock mode. */
export default requireOptionalNativeModule<TimoBeaconsModule>('TimoBeacons');
