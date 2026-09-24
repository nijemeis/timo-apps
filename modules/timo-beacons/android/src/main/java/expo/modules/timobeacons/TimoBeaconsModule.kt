package expo.modules.timobeacons

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/** JS bridge to [TimoCore]/[TimoService]. The engine keeps running without it (boot receiver, service). */
class TimoBeaconsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable" }

  override fun definition() = ModuleDefinition {
    Name("TimoBeacons")

    Events("onPresence", "onState", "onRanged", "onError")

    OnCreate {
      TimoCore.init(context)
      TimoCore.emit = { name, payload -> sendEvent(name, payload) }
      TimoCore.foreground = true
      TimoCore.upload()
    }

    OnActivityEntersForeground {
      TimoCore.foreground = true
      TimoService.poke()
      TimoCore.upload()
    }

    OnActivityEntersBackground {
      TimoCore.foreground = false
      TimoService.poke()
    }

    OnDestroy {
      TimoCore.emit = null
      TimoCore.foreground = false
    }

    AsyncFunction("isAvailable") {
      val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
    }

    AsyncFunction("getPermissions") { permissionState() }

    AsyncFunction("requestPermission") { kind: String, promise: Promise ->
      val perms: Array<String> = when (kind) {
        "bluetooth" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT) else arrayOf()
        // Android 11+: "Allow all the time" must be a separate request after foreground location is granted.
        "location" -> if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
          else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION) else arrayOf()
        "notifications" -> if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else arrayOf()
        else -> { promise.reject("ERR_KIND", "Unknown permission $kind", null); return@AsyncFunction }
      }
      val manager = appContext.permissions
      if (perms.isEmpty() || manager == null) { promise.resolve(permissionState()); return@AsyncFunction }
      manager.askForPermissions(PermissionsResponseListener { result ->
        markDenied(kind, result.values.any { it.status != expo.modules.interfaces.permissions.PermissionsStatus.GRANTED && !it.canAskAgain })
        // Foreground location just granted: ask for background right away, as the onboarding step intends.
        if (kind == "location" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && has(Manifest.permission.ACCESS_FINE_LOCATION) && !has(Manifest.permission.ACCESS_BACKGROUND_LOCATION) && perms.contains(Manifest.permission.ACCESS_FINE_LOCATION)) {
          manager.askForPermissions(PermissionsResponseListener { r ->
            markDenied("location", r.values.any { it.status != expo.modules.interfaces.permissions.PermissionsStatus.GRANTED && !it.canAskAgain })
            promise.resolve(permissionState())
          }, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
          promise.resolve(permissionState())
        }
      }, *perms)
    }

    AsyncFunction("openSettings") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("requestBatteryExemption") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
        // The settings list (no special permission needed, and allowed by Play policy).
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(intent) } catch (_: Exception) {
          context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
      }
      null
    }

    AsyncFunction("configure") { raw: Map<String, Any?> ->
      TimoCore.configure(JSONObject(raw))
    }

    AsyncFunction("setPreferences") { raw: Map<String, Any?> ->
      @Suppress("UNCHECKED_CAST")
      val strings = (raw["strings"] as? Map<String, Any?>)?.let { JSONObject(it) }
      TimoCore.setPreferences(raw["sounds"] as? Boolean, raw["notifications"] as? Boolean, strings)
    }

    AsyncFunction("start") { TimoCore.start() }
    AsyncFunction("stop") { TimoCore.stop() }
    AsyncFunction("reset") { TimoCore.reset() }
    AsyncFunction("getState") { TimoCore.state() }

    AsyncFunction("flush") { promise: Promise ->
      TimoCore.upload { promise.resolve(TimoCore.state()) }
    }

    AsyncFunction("startRanging") { TimoService.rangingRequested = true }
    AsyncFunction("stopRanging") { TimoService.rangingRequested = false }

    AsyncFunction("simulate") { type: String, minor: Int -> TimoCore.simulate(type, minor) }
  }

  /** Android only tells us "don't ask again" in the request result, so remember it per kind. */
  private fun markDenied(kind: String, denied: Boolean) {
    context.getSharedPreferences("timo.permissions", Context.MODE_PRIVATE).edit().putBoolean(kind, denied).apply()
  }
  private fun denied(kind: String) = context.getSharedPreferences("timo.permissions", Context.MODE_PRIVATE).getBoolean(kind, false)

  private fun has(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

  private fun permissionState() = bundleOf(
    "bluetooth" to when {
      (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.isEnabled != true -> "unavailable"
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S -> "granted"
      has(Manifest.permission.BLUETOOTH_SCAN) -> "granted"
      denied("bluetooth") -> "denied"
      else -> "undetermined"
    },
    "location" to when {
      !has(Manifest.permission.ACCESS_FINE_LOCATION) -> if (denied("location")) "denied" else "undetermined"
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || has(Manifest.permission.ACCESS_BACKGROUND_LOCATION) -> "always"
      else -> "whenInUse"
    },
    "notifications" to if (NotificationManagerCompat.from(context).areNotificationsEnabled()) "granted" else if (denied("notifications")) "denied" else "undetermined",
    "batteryUnrestricted" to (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName),
  )
}
