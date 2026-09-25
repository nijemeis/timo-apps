# Timo — iOS & Android app

Automatic time registration: walk past a Timo beacon at your workplace entrance and you're checked in; leave
and you're checked out — with a chime, a local notification and (app open) a confirmation sheet. Backend and
admins: [`nijemeis/timo-web`](https://github.com/nijemeis/timo-web) (the design handoff lives there in `design/`).

Expo SDK 57 · React Native 0.86 · TypeScript. Bundle id `com.sensimity.timo` (iOS team `MY74K55V88`,
Android package the same). EN/NL.

## How detection works: pass the gate
Every pass of a company beacon toggles: checked out → check in, checked in → check out, timestamped at the
pass, with a chime, a local notification and (app open) a confirmation sheet. Out of range in between means
nothing, so field workers and people behind walls or in lifts stay checked in. A sighting counts as a pass
only when no company beacon was heard for the company's away time (default 3 min) and the pass lock (default
15 min) has elapsed since the previous pass. A check-in left open at midnight is dropped (the server closes it
at 23:59 as `auto`).

It is decided **natively** in `modules/timo-beacons`, because it must work with the app killed and the phone
locked, when no JavaScript runs:

- **iOS** (`ios/TimoEngine.swift`): one `CLBeaconRegion` = Timo UUID + the company's major. Region entry
  (which relaunches a terminated app — the engine is created at launch by `TimoAppDelegateSubscriber`) starts
  a 12 s ranging burst under a background task to learn the minor; if a quick walk-by is over before ranging
  hears anything, the entry itself counts as the pass (with the beacon heard most recently). Region exit
  only marks "away since".
- **Android** (`TimoService.kt` + `TimoCore.kt`): a location-type foreground service scans continuously in
  low-latency mode (a walk-by lasts seconds) with a hardware filter on iBeacon prefix + UUID + major
  (required for screen-off results). `TimoBootReceiver` resumes after reboot/update.
- Both keep config, state and an event queue on disk, post their own notifications
  (`assets/timo_checkin.wav` rising D5→A5, `timo_checkout.wav` falling), and upload the queue themselves to
  `POST /api/events` as `enter` (checked in) / `exit` (checked out) — idempotent via deviceId + seq; seq is
  floored at seconds-since-2024 so it survives sign-outs. On configure the engine adopts the server's open
  registration when nothing is queued. JS (`src/services/presence`) configures it from
  `/api/me/beacon-config`, mirrors its state and shows the sheet for foreground events.
- UUID `A1CA9F6B-CFC3-4DC6-9A4D-B4FB1B691C3D` — shared on purpose with Dealiteful/Luggo/Whemma/NoGo. Only the
  company's configured (major, minor) pairs count.
- Install beacons right at the gate with low transmit power and a short advertising interval (100–200 ms), so
  they are heard only — and quickly — when passing.
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
**Beacon simulator** drives the native engine (Pass / Out of range per beacon) end to end, including uploads.
Demo sign-in: `sanne.devries@northpier.example` → "demo: open the link" (the server only offers it in dev or
for `DEMO_LOGIN_DOMAINS`). Deep links: `timo://auth?token=…` (magic link), `?session=…` (SSO), `?error=…`.

`npm test` (formatting helpers) · `npm run typecheck`.

## Before the stores
Real email (Resend) on the server, universal links / app links for `/m/*` once a domain is chosen, store
listings, privacy text (only enter/exit at registered beacons is stored — no GPS or location history), and a
works-council (OR) note for Dutch customers.
