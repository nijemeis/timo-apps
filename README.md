# Timo — iOS & Android app

Automatic time registration: walk past a Timo beacon at your workplace entrance and you're checked in; leave
and you're checked out — with a chime, a local notification and (app open) a confirmation sheet. Backend and
admins: [`nijemeis/timo-web`](https://github.com/nijemeis/timo-web) (the design handoff lives there in `design/`).

Expo SDK 57 · React Native 0.86 · TypeScript. Bundle id `com.sensimity.timo` (iOS team `MY74K55V88`,
Android package the same). EN/NL.

## How detection works
Check-in/out is decided **natively** in `modules/timo-beacons` — it must work with the app killed and the
phone locked, when no JavaScript runs:

- **iOS** (`ios/TimoEngine.swift`): one `CLBeaconRegion` = Timo UUID + the company's major. Region entry
  (which relaunches a terminated app — the engine is created at launch by `TimoAppDelegateSubscriber`) starts
  a 12 s ranging burst under a background task to learn the minor. Region exit queues the exit at the
  last-seen time and schedules the check-out notification after the grace period; a beacon at the same
  location within the grace period cancels it (the server merges the two).
- **Android** (`TimoService.kt` + `TimoCore.kt`): a location-type foreground service scans with a hardware
  filter on iBeacon prefix + UUID + major (required for screen-off results). No beacon of the current
  location for the grace period → check out at the last sighting. `TimoBootReceiver` resumes after reboot/update.
- Both keep config, state and an event queue on disk, post their own notifications
  (`assets/timo_checkin.wav` rising D5→A5, `timo_checkout.wav` falling), and upload the queue themselves to
  `POST /api/events` (idempotent via deviceId + seq; seq is floored at seconds-since-2024 so it survives
  sign-outs). JS (`src/services/presence`) configures the engine from `/api/me/beacon-config`, mirrors its
  state and shows the sheet for foreground events.
- UUID `A1CA9F6B-CFC3-4DC6-9A4D-B4FB1B691C3D` — shared on purpose with Dealiteful/Luggo/Whemma/NoGo. Only the
  company's configured (major, minor) pairs count. Zone beacons at the same location never split a registration.
- This is the **fifth** copy of the family's beacon code (Dealiteful → Luggo → Whemma → NoGo → Timo), rewritten
  as a self-contained engine; fixes don't propagate between the apps.

## Run
```bash
npm install
npx expo prebuild
npm run ios        # sets the UTF-8 locale CocoaPods needs on this Mac
npm run android    # ANDROID_HOME=~/Library/Android/sdk
```
The API defaults to `app.json → extra.apiUrl` (http://localhost:3200); point a build elsewhere with
`EXPO_PUBLIC_API_URL=https://… npx expo start`. The simulator has no Bluetooth: in dev builds Profile →
**Beacon simulator** drives the native engine (Walk in / Leave per beacon) end to end, including uploads.
Demo sign-in: `sanne.devries@northpier.example` → "demo: open the link" (the server only offers it in dev or
for `DEMO_LOGIN_DOMAINS`). Deep links: `timo://auth?token=…` (magic link), `?session=…` (SSO), `?error=…`.

`npm test` (formatting helpers) · `npm run typecheck`.

## Before the stores
Real email (Resend) on the server, universal links / app links for `/m/*` once a domain is chosen, store
listings, privacy text (only enter/exit at registered beacons is stored — no GPS or location history), and a
works-council (OR) note for Dutch customers.
