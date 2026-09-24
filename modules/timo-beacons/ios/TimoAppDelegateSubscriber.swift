import ExpoModulesCore

/**
 Creates the presence engine as the app launches. When iOS relaunches a terminated Timo in the background
 for a beacon region event, the CLLocationManager delegate must exist before the event is delivered — long
 before JavaScript (or the Expo module) is loaded.
 */
public class TimoAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    TimoEngine.shared.boot()
    return true
  }
}
