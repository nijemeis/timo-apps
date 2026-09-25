/**
 * The native pass-the-gate engine. Every pass of a company beacon toggles: out → check in, in → check out;
 * being out of range in between means nothing. A sighting only counts as a pass when the beacon was out of
 * sight for `awaySeconds` and `lockSeconds` have passed since the previous pass. It is decided natively
 * (Swift / Kotlin) because it has to work with the app closed and the phone locked: the engine keeps its state and an event queue on disk, posts the
 * local notification itself and uploads the queue to POST /api/events on its own. JS configures it, mirrors
 * its state for the UI and flushes the queue whenever the app is open.
 */

export interface NativeBeacon {
  minor: number;
  locationId: string | null;
  location: string;
  spot: string;
}

/** Localised notification copy; {location}, {spot}, {time} and {duration} are substituted natively. */
export interface NativeStrings {
  inTitle: string; // "Checked in · {location}"
  inBody: string; // "Time registration started at {time} · {spot}"
  outTitle: string; // "Checked out · {location}"
  outBody: string; // "Registered {duration} · {spot}"
  hoursUnit: string; // "h" | "u"
  minutesUnit: string; // "m"
  serviceTitle: string; // Android foreground-service notification
  serviceBody: string;
}

export interface NativeConfig {
  uuid: string;
  major: number;
  beacons: NativeBeacon[];
  /** Out of sight at least this long before a sighting counts as a new pass. */
  awaySeconds: number;
  /** At least this long between two passes. */
  lockSeconds: number;
  /** The server's open registration (epoch ms), used to align a fresh engine; ignored while events are queued. */
  serverOpen: { minor: number | null; since: number } | null;
  apiUrl: string;
  token: string;
  deviceId: string;
  sounds: boolean;
  notifications: boolean;
  strings: NativeStrings;
}

export interface NativeInside {
  minor: number;
  locationId: string | null;
  location: string;
  spot: string;
  /** epoch ms */
  since: number;
  lastSeen: number;
}

export interface NativeState {
  configured: boolean;
  monitoring: boolean;
  inside: NativeInside | null;
  /** epoch ms of the last pass that toggled the state */
  lastPassAt: number | null;
  /** epoch ms since which no company beacon has been heard (null while one is in range) */
  awaySince: number | null;
  queued: number;
  lastSyncAt: number | null;
  lastSyncError: string | null;
}

export interface RangedBeacon {
  major: number;
  minor: number;
  rssi: number;
  known: boolean;
}

export interface PresencePayload {
  type: 'in' | 'out';
  minor: number;
  location: string;
  spot: string;
  /** epoch ms of the check-in / check-out */
  at: number;
  /** check-outs: epoch ms of the matching check-in */
  since: number | null;
  /** true when the app was in the foreground: JS shows the bottom sheet + chime instead of a notification */
  foreground: boolean;
}

export interface PermissionState {
  bluetooth: 'granted' | 'denied' | 'undetermined' | 'unavailable';
  /** 'always' is what Timo needs; 'whenInUse' only works with the app open. */
  location: 'always' | 'whenInUse' | 'denied' | 'undetermined';
  notifications: 'granted' | 'denied' | 'undetermined';
  /** Android: the app is exempt from battery optimisation (iOS: always true). */
  batteryUnrestricted: boolean;
}

export type TimoBeaconsEvents = {
  onPresence: (e: PresencePayload) => void;
  onState: (e: NativeState) => void;
  onRanged: (e: { beacons: RangedBeacon[] }) => void;
  onError: (e: { message: string }) => void;
};
