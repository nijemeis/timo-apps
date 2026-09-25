import CoreBluetooth
import CoreLocation
import UIKit
import UserNotifications

/**
 Timo's pass-the-gate engine for iOS.

 iBeacons reach an iOS app only through CoreLocation. Timo monitors ONE region — the Timo UUID plus the
 company's major — which survives termination: iOS relaunches the app in the background on enter/exit.
 Monitoring doesn't report the minor, so on enter (and whenever the screen lights up inside the region) the
 engine ranges for a short burst to learn which beacon it is.

 Rules (mirroring the backend's engine.ts):
  - every pass of a company beacon toggles: checked out → check in, checked in → check out, timestamped
    at the pass; being out of range in between means nothing (a field worker stays checked in)
  - a sighting is a pass only if no company beacon was heard for `awaySeconds` before it, and at least
    `lockSeconds` have passed since the previous pass — so standing at the gate never flips the state back
  - a check-in from an earlier day is dropped at midnight (the server closes it at 23:59 as `auto`)

 Everything — config, state, queue — is persisted, so a background relaunch works without JavaScript.
 Events are uploaded natively to POST /api/events (idempotent on deviceId + seq).
 */
final class TimoEngine: NSObject, CLLocationManagerDelegate, CBCentralManagerDelegate {
  static let shared = TimoEngine()

  // MARK: Persisted model

  struct Beacon: Codable { let minor: Int; let locationId: String?; let location: String; let spot: String }
  struct Strings: Codable {
    var inTitle: String; var inBody: String; var outTitle: String; var outBody: String
    var hoursUnit: String; var minutesUnit: String
  }
  struct ServerOpen: Codable { var minor: Int?; var since: Double }
  struct Config: Codable {
    var uuid: String; var major: Int; var beacons: [Beacon]; var awaySeconds: Double; var lockSeconds: Double
    var serverOpen: ServerOpen?
    var apiUrl: String; var token: String; var deviceId: String
    var sounds: Bool; var notifications: Bool; var strings: Strings
  }
  struct Inside: Codable { var minor: Int; var locationId: String?; var location: String; var spot: String; var since: Date; var lastSeen: Date }
  struct State: Codable {
    var monitoring = false
    var inside: Inside?
    /// The last sighting that toggled the state.
    var lastPassAt: Date?
    /// The last time any company beacon was heard, and since when none has been (region exit).
    var lastHeardAt: Date?
    var awaySince: Date?
    /// Which beacon was heard last — the best guess when a region entry can't be ranged.
    var lastHeardMinor: Int?
    var nextSeq = 0
    var lastSyncAt: Date?
    var lastSyncError: String?
  }
  struct QueuedEvent: Codable { let seq: Int; let type: String; let uuid: String; let major: Int; let minor: Int; let at: Date; let rssi: Int? }

  private let defaults = UserDefaults.standard
  private let configKey = "timo.engine.config"
  private let stateKey = "timo.engine.state"
  private let queueKey = "timo.engine.queue"

  private(set) var config: Config?
  private(set) var state = State()
  private var queue: [QueuedEvent] = []

  // MARK: Runtime

  private let lm = CLLocationManager()
  private var central: CBCentralManager?
  private var booted = false
  private var burstUntil: Date?
  private var foregroundRanging = false
  private var rangingActive = false
  private var bgTask: UIBackgroundTaskIdentifier = .invalid
  /// A region entry not yet resolved by ranging (a quick walk-by can be over before ranging starts).
  private var pendingEntry: Date?
  private var uploading = false
  private var permissionWaiters: [(String) -> Void] = []
  private var bluetoothWaiters: [() -> Void] = []

  /// Set by the Expo module: (eventName, payload).
  var emit: ((String, [String: Any]) -> Void)?

  private static let seqEpoch = Date(timeIntervalSince1970: 1_704_067_200) // 2024-01-01

  override private init() {
    super.init()
  }

  /// Called at app launch (TimoAppDelegateSubscriber) and by the module; idempotent.
  func boot() {
    if booted { return }
    booted = true
    load()
    lm.delegate = self
    lm.pausesLocationUpdatesAutomatically = false
    NotificationCenter.default.addObserver(self, selector: #selector(appActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    if state.monitoring, config != nil { startMonitoring() }
    if !queue.isEmpty { upload() }
  }

  // MARK: Persistence

  private func load() {
    let dec = JSONDecoder()
    if let d = defaults.data(forKey: configKey) { config = try? dec.decode(Config.self, from: d) }
    if let d = defaults.data(forKey: stateKey), let s = try? dec.decode(State.self, from: d) { state = s }
    if let d = defaults.data(forKey: queueKey), let q = try? dec.decode([QueuedEvent].self, from: d) { queue = q }
  }

  private func save() {
    let enc = JSONEncoder()
    if let c = config, let d = try? enc.encode(c) { defaults.set(d, forKey: configKey) } else { defaults.removeObject(forKey: configKey) }
    if let d = try? enc.encode(state) { defaults.set(d, forKey: stateKey) }
    if let d = try? enc.encode(queue) { defaults.set(d, forKey: queueKey) }
    emit?("onState", stateDict())
  }

  // MARK: Public API (module)

  func configure(_ c: Config) {
    let majorChanged = config?.major != c.major || config?.uuid.uppercased() != c.uuid.uppercased()
    config = c
    // Nothing of ours waiting for the server: take its view (fresh install, another phone, an admin fix).
    if queue.isEmpty {
      if let o = c.serverOpen {
        let since = Date(timeIntervalSince1970: o.since / 1000)
        if state.inside.map({ abs($0.since.timeIntervalSince(since)) > 1 }) ?? true {
          let b = o.minor.flatMap { m in c.beacons.first { $0.minor == m } }
          state.inside = Inside(minor: o.minor ?? -1, locationId: b?.locationId, location: b?.location ?? "", spot: b?.spot ?? "", since: since, lastSeen: since)
        }
      } else {
        state.inside = nil
      }
    }
    rollDay(Date())
    save()
    if majorChanged && state.monitoring { startMonitoring() }
  }

  func setPreferences(sounds: Bool?, notifications: Bool?, strings: Strings?) {
    guard var c = config else { return }
    if let s = sounds { c.sounds = s }
    if let n = notifications { c.notifications = n }
    if let s = strings { c.strings = s }
    config = c
    save()
  }

  func start() {
    state.monitoring = true
    save()
    startMonitoring()
  }

  func stop() {
    state.monitoring = false
    save()
    for r in lm.monitoredRegions { lm.stopMonitoring(for: r) }
    stopRanging(force: true)
  }

  func reset() {
    stop()
    let seq = state.nextSeq
    config = nil
    state = State()
    state.nextSeq = seq
    queue = []
    save()
  }

  func setForegroundRanging(_ on: Bool) {
    foregroundRanging = on
    if on { startRanging() } else { stopRanging(force: false) }
  }

  func simulate(type: String, minor: Int) {
    guard let c = config, let b = c.beacons.first(where: { $0.minor == minor }) else { return }
    let now = Date()
    if type == "pass" {
      rollDay(now)
      state.lastHeardAt = now
      state.awaySince = nil
      toggle(b, rssi: -60, now: now)
    } else {
      state.awaySince = now
      save()
    }
  }

  func flush(_ done: @escaping () -> Void) {
    upload(done)
  }

  var isAvailable: Bool {
    CLLocationManager.isMonitoringAvailable(for: CLBeaconRegion.self) && CLLocationManager.isRangingAvailable()
  }

  func stateDict() -> [String: Any] {
    func insideDict(_ i: Inside) -> [String: Any] {
      ["minor": i.minor, "locationId": i.locationId as Any, "location": i.location, "spot": i.spot, "since": ms(i.since), "lastSeen": ms(i.lastSeen)]
    }
    return [
      "configured": config != nil,
      "monitoring": state.monitoring,
      "inside": state.inside.map(insideDict) as Any,
      "lastPassAt": state.lastPassAt.map(ms) as Any,
      "awaySince": state.awaySince.map(ms) as Any,
      "queued": queue.count,
      "lastSyncAt": state.lastSyncAt.map(ms) as Any,
      "lastSyncError": state.lastSyncError as Any,
    ]
  }

  // MARK: Monitoring & ranging

  private func region(_ c: Config) -> CLBeaconRegion? {
    guard let uuid = UUID(uuidString: c.uuid) else { return nil }
    let r = CLBeaconRegion(uuid: uuid, major: CLBeaconMajorValue(c.major), identifier: "timo.\(c.major)")
    r.notifyOnEntry = true
    r.notifyOnExit = true
    // Screen-on while inside delivers didDetermineState → another chance to resolve the minor.
    r.notifyEntryStateOnDisplay = true
    return r
  }

  private func startMonitoring() {
    guard let c = config, let r = region(c) else { return }
    for existing in lm.monitoredRegions where existing.identifier != r.identifier { lm.stopMonitoring(for: existing) }
    guard CLLocationManager.isMonitoringAvailable(for: CLBeaconRegion.self) else { return }
    lm.startMonitoring(for: r)
    lm.requestState(for: r)
  }

  private func startRanging() {
    guard let c = config, let uuid = UUID(uuidString: c.uuid), CLLocationManager.isRangingAvailable() else { return }
    if rangingActive { return }
    rangingActive = true
    lm.startRangingBeacons(satisfying: CLBeaconIdentityConstraint(uuid: uuid, major: CLBeaconMajorValue(c.major)))
  }

  private func stopRanging(force: Bool) {
    guard rangingActive, let c = config, let uuid = UUID(uuidString: c.uuid) else { rangingActive = false; return }
    if !force && (foregroundRanging || (burstUntil.map { $0 > Date() } ?? false)) { return }
    lm.stopRangingBeacons(satisfying: CLBeaconIdentityConstraint(uuid: uuid, major: CLBeaconMajorValue(c.major)))
    rangingActive = false
  }

  /// Range for a few seconds under a background task — enough to learn the minor after a wake-up.
  private func burst(seconds: TimeInterval = 12) {
    beginBackgroundTask()
    burstUntil = Date().addingTimeInterval(seconds)
    startRanging()
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds + 0.5) { [weak self] in
      guard let self else { return }
      self.burstUntil = nil
      self.stopRanging(force: false)
      // Entered the region but never ranged a known beacon: the entry itself is the pass.
      if let at = self.pendingEntry, let c = self.config {
        self.pendingEntry = nil
        let b = self.state.lastHeardMinor.flatMap { m in c.beacons.first { $0.minor == m } } ?? c.beacons.first
        if let b { self.heard(b, rssi: nil, at: at) }
      }
      self.upload { self.endBackgroundTask() }
    }
  }

  private func beginBackgroundTask() {
    guard bgTask == .invalid else { return }
    bgTask = UIApplication.shared.beginBackgroundTask(withName: "timo.presence") { [weak self] in self?.endBackgroundTask() }
  }

  private func endBackgroundTask() {
    guard bgTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(bgTask)
    bgTask = .invalid
  }

  // MARK: Engine

  private func beacon(minor: Int) -> Beacon? { config?.beacons.first { $0.minor == minor } }

  /// A check-in from an earlier local day is over: the server closed it at 23:59 (`auto`).
  private func rollDay(_ now: Date) {
    if let i = state.inside, !Calendar.current.isDate(i.since, inSameDayAs: now) { state.inside = nil }
  }

  /// A known company beacon was ranged.
  private func heard(_ b: Beacon, rssi: Int?, at now: Date) {
    guard let c = config else { return }
    rollDay(now)
    let wasAway = state.lastHeardAt == nil || (state.awaySince.map { now.timeIntervalSince($0) >= c.awaySeconds } ?? false)
    let unlocked = state.lastPassAt.map { now.timeIntervalSince($0) >= c.lockSeconds } ?? true
    state.lastHeardAt = now
    state.awaySince = nil
    state.lastHeardMinor = b.minor
    pendingEntry = nil
    if wasAway && unlocked {
      toggle(b, rssi: rssi, now: now)
    } else {
      if var i = state.inside { i.lastSeen = now; state.inside = i }
      save()
    }
  }

  /// A pass: check in when out, check out when in.
  private func toggle(_ b: Beacon, rssi: Int?, now: Date) {
    guard let c = config else { return }
    state.lastPassAt = now
    if let i = state.inside {
      state.inside = nil
      enqueue(type: "exit", minor: b.minor, at: now, rssi: rssi, c: c)
      save()
      let at = Inside(minor: b.minor, locationId: b.locationId, location: b.location.isEmpty ? i.location : b.location, spot: b.spot, since: i.since, lastSeen: now)
      announce(type: "out", inside: at, at: now, since: i.since)
    } else {
      let i = Inside(minor: b.minor, locationId: b.locationId, location: b.location, spot: b.spot, since: now, lastSeen: now)
      state.inside = i
      enqueue(type: "enter", minor: b.minor, at: now, rssi: rssi, c: c)
      save()
      announce(type: "in", inside: i, at: now, since: nil)
    }
    upload()
  }

  /// No company beacon in range any more (CoreLocation reports this ~30 s after the last advertisement).
  private func regionExited(now: Date) {
    if state.awaySince == nil { state.awaySince = now.addingTimeInterval(-30) }
    save()
  }

  private func announce(type: String, inside: Inside, at: Date, since: Date?) {
    let fg = UIApplication.shared.applicationState == .active
    if !fg { postNotification(type: type, inside: inside, at: at, since: since, after: nil, id: "timo.\(type).\(Int(at.timeIntervalSince1970))") }
    emit?("onPresence", presencePayload(type: type, inside: inside, at: at, since: since, foreground: fg))
  }

  private func presencePayload(type: String, inside: Inside, at: Date, since: Date?, foreground: Bool) -> [String: Any] {
    ["type": type, "minor": inside.minor, "location": inside.location, "spot": inside.spot, "at": ms(at), "since": since.map(ms) as Any, "foreground": foreground]
  }

  private func enqueue(type: String, minor: Int, at: Date, rssi: Int?, c: Config) {
    // Seq must only grow, even across sign-out/reinstall of the queue: floor it at seconds since 2024.
    let floor = Int(Date().timeIntervalSince(Self.seqEpoch))
    state.nextSeq = max(state.nextSeq + 1, floor)
    queue.append(QueuedEvent(seq: state.nextSeq, type: type, uuid: c.uuid.uppercased(), major: c.major, minor: minor, at: at, rssi: rssi))
    if queue.count > 2000 { queue.removeFirst(queue.count - 2000) }
  }

  // MARK: Notifications

  private func postNotification(type: String, inside: Inside, at: Date, since: Date?, after: TimeInterval?, id: String) {
    guard let c = config, c.notifications else { return }
    let s = c.strings
    let fmt = DateFormatter()
    fmt.dateFormat = "HH:mm"
    let duration: String = {
      guard let since else { return "" }
      let mins = max(0, Int((at.timeIntervalSince(since) / 60).rounded()))
      return "\(mins / 60)\(s.hoursUnit) \(String(format: "%02d", mins % 60))\(s.minutesUnit)"
    }()
    func fill(_ t: String) -> String {
      t.replacingOccurrences(of: "{location}", with: inside.location)
        .replacingOccurrences(of: "{spot}", with: inside.spot)
        .replacingOccurrences(of: "{time}", with: fmt.string(from: at))
        .replacingOccurrences(of: "{duration}", with: duration)
    }
    let content = UNMutableNotificationContent()
    content.title = fill(type == "in" ? s.inTitle : s.outTitle)
    content.body = fill(type == "in" ? s.inBody : s.outBody)
    if c.sounds { content.sound = UNNotificationSound(named: UNNotificationSoundName(type == "in" ? "timo_checkin.wav" : "timo_checkout.wav")) }
    content.threadIdentifier = "timo.presence"
    content.userInfo = ["timo": type]
    let trigger = after.map { UNTimeIntervalNotificationTrigger(timeInterval: max(1, $0), repeats: false) }
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
  }

  // MARK: Upload

  func upload(_ done: (() -> Void)? = nil) {
    guard let c = config, !queue.isEmpty, !uploading, let url = URL(string: "\(c.apiUrl)/api/events") else { done?(); return }
    uploading = true
    let batch = Array(queue.prefix(200))
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let body: [String: Any] = [
      "deviceId": c.deviceId,
      "events": batch.map { e -> [String: Any] in
        ["seq": e.seq, "type": e.type, "uuid": e.uuid, "major": e.major, "minor": e.minor, "at": iso.string(from: e.at), "rssi": e.rssi as Any]
      },
    ]
    var req = URLRequest(url: url, timeoutInterval: 20)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(c.token)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    let task = UIApplication.shared.beginBackgroundTask(withName: "timo.upload")
    URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
      DispatchQueue.main.async {
        guard let self else { return }
        self.uploading = false
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if let error {
          self.state.lastSyncError = error.localizedDescription
        } else if (200..<300).contains(status), let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
          let ack = (json["ackSeq"] as? Int) ?? batch.last?.seq ?? 0
          let sent = Set(batch.map { $0.seq })
          self.queue.removeAll { sent.contains($0.seq) || $0.seq <= ack }
          self.state.lastSyncAt = Date()
          self.state.lastSyncError = nil
        } else {
          self.state.lastSyncError = "HTTP \(status)"
        }
        self.save()
        UIApplication.shared.endBackgroundTask(task)
        if self.state.lastSyncError == nil && !self.queue.isEmpty { self.upload(done) } else { done?() }
      }
    }.resume()
  }

  // MARK: Permissions

  func permissions() -> [String: Any] {
    let loc: String
    switch lm.authorizationStatus {
    case .authorizedAlways: loc = "always"
    case .authorizedWhenInUse: loc = "whenInUse"
    case .denied, .restricted: loc = "denied"
    default: loc = "undetermined"
    }
    let bt: String
    switch CBCentralManager.authorization {
    case .allowedAlways: bt = (central?.state == .poweredOff) ? "unavailable" : "granted"
    case .denied, .restricted: bt = "denied"
    default: bt = "undetermined"
    }
    return ["bluetooth": bt, "location": loc, "notifications": notificationStatus, "batteryUnrestricted": true]
  }

  private var notificationStatus = "undetermined"

  func refreshNotificationStatus(_ done: @escaping () -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { s in
      DispatchQueue.main.async {
        switch s.authorizationStatus {
        case .authorized, .provisional, .ephemeral: self.notificationStatus = "granted"
        case .denied: self.notificationStatus = "denied"
        default: self.notificationStatus = "undetermined"
        }
        // Touch the Bluetooth manager once authorised, so a powered-off radio is reported.
        if CBCentralManager.authorization == .allowedAlways && self.central == nil {
          self.central = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: false])
        }
        done()
      }
    }
  }

  func requestBluetooth(_ done: @escaping () -> Void) {
    if central != nil && CBCentralManager.authorization != .notDetermined { done(); return }
    bluetoothWaiters.append(done)
    // Creating the manager shows the NSBluetoothAlwaysUsageDescription prompt.
    central = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: false])
  }

  func requestLocation(_ done: @escaping () -> Void) {
    let status = lm.authorizationStatus
    if status == .authorizedAlways || status == .denied || status == .restricted { done(); return }
    permissionWaiters.append { _ in done() }
    // Not determined → the first prompt; When-in-use → the one-time upgrade prompt to Always.
    lm.requestAlwaysAuthorization()
    // If iOS decides not to show a prompt, don't hang: resolve once the app is active again.
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
      if UIApplication.shared.applicationState == .active { self?.resolveLocationWaiters() }
    }
  }

  func requestNotifications(_ done: @escaping () -> Void) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
      self.refreshNotificationStatus(done)
    }
  }

  private func resolveLocationWaiters() {
    let w = permissionWaiters
    permissionWaiters = []
    w.forEach { $0("") }
  }

  @objc private func appActive() {
    if !permissionWaiters.isEmpty && lm.authorizationStatus != .notDetermined { resolveLocationWaiters() }
    if !queue.isEmpty { upload() }
    if state.monitoring, let c = config, let r = region(c) { lm.requestState(for: r) }
  }

  // MARK: CBCentralManagerDelegate

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    let w = bluetoothWaiters
    bluetoothWaiters = []
    w.forEach { $0() }
  }

  // MARK: CLLocationManagerDelegate

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    if manager.authorizationStatus != .notDetermined { resolveLocationWaiters() }
    if state.monitoring && (manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse) { startMonitoring() }
  }

  func locationManager(_ manager: CLLocationManager, didDetermineState regionState: CLRegionState, for region: CLRegion) {
    guard region is CLBeaconRegion else { return }
    switch regionState {
    case .inside: burst()
    case .outside: regionExited(now: Date())
    default: break
    }
  }

  func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    guard region is CLBeaconRegion else { return }
    pendingEntry = Date()
    burst()
  }

  func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
    guard region is CLBeaconRegion else { return }
    regionExited(now: Date())
  }

  func locationManager(_ manager: CLLocationManager, didRange beacons: [CLBeacon], satisfying constraint: CLBeaconIdentityConstraint) {
    guard let c = config else { return }
    let ranged = beacons.filter { $0.rssi != 0 && $0.major.intValue == c.major }
    if foregroundRanging {
      emit?("onRanged", ["beacons": ranged.map { ["major": $0.major.intValue, "minor": $0.minor.intValue, "rssi": $0.rssi, "known": beacon(minor: $0.minor.intValue) != nil] }])
    }
    // Strongest known beacon decides.
    guard let best = ranged.filter({ beacon(minor: $0.minor.intValue) != nil }).max(by: { $0.rssi < $1.rssi }),
          let b = beacon(minor: best.minor.intValue) else { return }
    self.heard(b, rssi: best.rssi, at: Date())
  }

  func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
    emit?("onError", ["message": "monitoring failed: \(error.localizedDescription)"])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    emit?("onError", ["message": error.localizedDescription])
  }
}

private func ms(_ d: Date) -> Double { (d.timeIntervalSince1970 * 1000).rounded() }
