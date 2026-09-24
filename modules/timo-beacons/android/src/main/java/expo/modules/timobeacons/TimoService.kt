package expo.modules.timobeacons

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import java.nio.ByteBuffer
import java.util.UUID

/**
 * Foreground service that owns the BLE scan. Android offers no iBeacon region monitoring and stops
 * delivering scan results shortly after an app leaves the foreground, so a location-type foreground
 * service (with its "Timo is active" notification) is what keeps detection working with the phone locked.
 *
 * The scan filter matches the iBeacon prefix + Timo UUID + the company major in the BLE controller —
 * required for results while the screen is off, and cheap. Every match goes to [TimoCore.seen]; a tick
 * every 10 s lets the engine apply the check-out grace period.
 */
class TimoService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var scanning = false
  private var scanMode = -1
  private val nearby = mutableMapOf<Int, Pair<Int, Long>>() // minor → (rssi, at)

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    TimoCore.init(this)
    instance = this
    val n = buildNotification()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      else startForeground(NOTIFICATION_ID, n)
    } catch (e: Exception) {
      // Android 14+ refuses a location FGS without location permission, or from the background (12+).
      TimoCore.emit?.invoke("onError", bundleOf("message" to "Background detection could not start: ${e.message}"))
      stopSelf()
      return
    }
    handler.post(tick)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!TimoCore.monitoring || TimoCore.config == null) { stopSelf(); return START_NOT_STICKY }
    restartScan()
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopScan()
    if (instance === this) instance = null
    super.onDestroy()
  }

  private val tick = object : Runnable {
    override fun run() {
      TimoCore.tick()
      // Foreground: a faster scan for snappy check-ins; background: low power (grace covers the gaps).
      val wanted = if (TimoCore.foreground) ScanSettings.SCAN_MODE_LOW_LATENCY else ScanSettings.SCAN_MODE_LOW_POWER
      if (wanted != scanMode) restartScan()
      emitNearby()
      handler.postDelayed(this, 10_000)
    }
  }

  private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

  private fun restartScan() {
    stopScan()
    val uuid = TimoCore.uuid ?: return
    val major = TimoCore.major
    if (major < 0) return
    val scanner = (getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.takeIf { it.isEnabled }?.bluetoothLeScanner ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !granted(Manifest.permission.BLUETOOTH_SCAN)) return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !granted(Manifest.permission.ACCESS_FINE_LOCATION)) return

    // iBeacon manufacturer data: 02 15 | UUID (16) | major (2) | minor (2) | tx power (1)
    val u = UUID.fromString(uuid)
    val data = ByteBuffer.allocate(23).put(0x02).put(0x15).putLong(u.mostSignificantBits).putLong(u.leastSignificantBits)
      .putShort(major.toShort()).putShort(0).put(0).array()
    val mask = ByteArray(23) { i -> if (i < 20) 0xFF.toByte() else 0 }
    val filter = ScanFilter.Builder().setManufacturerData(APPLE, data, mask).build()
    scanMode = if (TimoCore.foreground) ScanSettings.SCAN_MODE_LOW_LATENCY else ScanSettings.SCAN_MODE_LOW_POWER
    val settings = ScanSettings.Builder().setScanMode(scanMode).setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES).build()
    try {
      scanner.startScan(listOf(filter), settings, callback)
      scanning = true
    } catch (e: SecurityException) {
      TimoCore.emit?.invoke("onError", bundleOf("message" to "Bluetooth scan permission missing"))
    }
  }

  private fun stopScan() {
    if (!scanning) return
    try {
      (getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.bluetoothLeScanner?.stopScan(callback)
    } catch (_: Exception) {}
    scanning = false
  }

  private val callback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult?) {
      val data = result?.scanRecord?.getManufacturerSpecificData(APPLE) ?: return
      if (data.size < 23 || data[0] != 0x02.toByte() || data[1] != 0x15.toByte()) return
      val major = ((data[18].toInt() and 0xFF) shl 8) or (data[19].toInt() and 0xFF)
      val minor = ((data[20].toInt() and 0xFF) shl 8) or (data[21].toInt() and 0xFF)
      if (major != TimoCore.major) return
      synchronized(nearby) { nearby[minor] = result.rssi to System.currentTimeMillis() }
      TimoCore.seen(minor, result.rssi)
    }

    override fun onScanFailed(errorCode: Int) {
      scanning = false
      TimoCore.emit?.invoke("onError", bundleOf("message" to "BLE scan failed ($errorCode)"))
    }
  }

  private fun emitNearby() {
    if (!rangingRequested) return
    val now = System.currentTimeMillis()
    val list = synchronized(nearby) {
      nearby.entries.removeAll { now - it.value.second > 15_000 }
      nearby.map { (minor, v) -> bundleOf("major" to TimoCore.major, "minor" to minor, "rssi" to v.first, "known" to (TimoCore.beacon(minor) != null)) }
    }
    TimoCore.emit?.invoke("onRanged", bundleOf("beacons" to list.toTypedArray()))
  }

  private fun buildNotification(): Notification {
    val s = TimoCore.strings()
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    return NotificationCompat.Builder(this, TimoCore.CH_SERVICE)
      .setSmallIcon(R.drawable.ic_timo_stat)
      .setColor(0xFF5980A6.toInt())
      .setContentTitle(s.optString("serviceTitle", "Timo is active"))
      .setContentText(s.optString("serviceBody", "Listening for Timo beacons at your workplace"))
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .apply { if (open != null) setContentIntent(open) }
      .build()
  }

  companion object {
    private const val APPLE = 0x004C
    private const val NOTIFICATION_ID = 7100
    @Volatile private var instance: TimoService? = null
    @Volatile var rangingRequested = false

    fun start(context: Context) {
      val intent = Intent(context, TimoService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      } catch (e: Exception) {
        TimoCore.emit?.invoke("onError", bundleOf("message" to "Background detection could not start: ${e.message}"))
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, TimoService::class.java))
    }

    /** Re-evaluate the scan mode right away (app came to the foreground or went away). */
    fun poke() {
      instance?.let { s -> s.handler.post { s.restartScan() } }
    }

    fun refreshNotification(context: Context) {
      val s = instance ?: return
      try { NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, s.buildNotification()) } catch (_: SecurityException) {}
    }
  }
}
