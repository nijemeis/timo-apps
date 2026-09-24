import ExpoModulesCore
import UIKit

/// JS bridge to TimoEngine. The engine outlives this module: it is booted at app launch and keeps working
/// with no JavaScript running; the module only configures it and relays its events.
public class TimoBeaconsModule: Module {
  private var engine: TimoEngine { TimoEngine.shared }

  public func definition() -> ModuleDefinition {
    Name("TimoBeacons")

    Events("onPresence", "onState", "onRanged", "onError")

    OnCreate {
      TimoEngine.shared.boot()
      TimoEngine.shared.emit = { [weak self] name, payload in self?.sendEvent(name, payload) }
    }

    OnDestroy {
      TimoEngine.shared.emit = nil
    }

    AsyncFunction("isAvailable") { () -> Bool in
      TimoEngine.shared.isAvailable
    }.runOnQueue(.main)

    AsyncFunction("getPermissions") { (promise: Promise) in
      self.engine.refreshNotificationStatus { promise.resolve(self.engine.permissions()) }
    }.runOnQueue(.main)

    AsyncFunction("requestPermission") { (kind: String, promise: Promise) in
      let done = { self.engine.refreshNotificationStatus { promise.resolve(self.engine.permissions()) } }
      switch kind {
      case "bluetooth": self.engine.requestBluetooth(done)
      case "location": self.engine.requestLocation(done)
      case "notifications": self.engine.requestNotifications(done)
      default: promise.reject("ERR_KIND", "Unknown permission \(kind)")
      }
    }.runOnQueue(.main)

    AsyncFunction("openSettings") {
      if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }.runOnQueue(.main)

    AsyncFunction("requestBatteryExemption") {}

    AsyncFunction("configure") { (raw: [String: Any], promise: Promise) in
      do {
        let data = try JSONSerialization.data(withJSONObject: raw)
        let config = try JSONDecoder().decode(TimoEngine.Config.self, from: data)
        self.engine.configure(config)
        promise.resolve(nil)
      } catch {
        promise.reject("ERR_CONFIG", "Invalid Timo config: \(error.localizedDescription)")
      }
    }.runOnQueue(.main)

    AsyncFunction("setPreferences") { (raw: [String: Any]) in
      var strings: TimoEngine.Strings?
      if let s = raw["strings"], let d = try? JSONSerialization.data(withJSONObject: s) {
        strings = try? JSONDecoder().decode(TimoEngine.Strings.self, from: d)
      }
      self.engine.setPreferences(sounds: raw["sounds"] as? Bool, notifications: raw["notifications"] as? Bool, strings: strings)
    }.runOnQueue(.main)

    AsyncFunction("start") { self.engine.start() }.runOnQueue(.main)
    AsyncFunction("stop") { self.engine.stop() }.runOnQueue(.main)
    AsyncFunction("reset") { self.engine.reset() }.runOnQueue(.main)
    AsyncFunction("getState") { () -> [String: Any] in self.engine.stateDict() }.runOnQueue(.main)

    AsyncFunction("flush") { (promise: Promise) in
      self.engine.flush { promise.resolve(self.engine.stateDict()) }
    }.runOnQueue(.main)

    AsyncFunction("startRanging") { self.engine.setForegroundRanging(true) }.runOnQueue(.main)
    AsyncFunction("stopRanging") { self.engine.setForegroundRanging(false) }.runOnQueue(.main)

    AsyncFunction("simulate") { (type: String, minor: Int) in
      self.engine.simulate(type: type, minor: minor)
    }.runOnQueue(.main)
  }
}
