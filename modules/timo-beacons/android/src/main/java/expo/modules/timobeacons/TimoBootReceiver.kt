package expo.modules.timobeacons

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Resume beacon detection after a reboot or an app update, if the user had it running. */
class TimoBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    TimoCore.init(context)
    if (TimoCore.monitoring && TimoCore.config != null) TimoService.start(context)
    TimoCore.upload()
  }
}
