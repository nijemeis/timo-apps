package expo.modules.timobeacons

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.os.bundleOf
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Timo's presence engine for Android — process-wide, persisted in SharedPreferences, so it runs the same
 * whether the app UI is open, in the background, or the process was restarted by [TimoBootReceiver].
 *
 * Android has no OS region monitoring, so [TimoService] scans continuously and feeds every sighting of a
 * configured (major, minor) into [seen]. The rules mirror the backend (web/src/lib/engine.ts):
 *  - first known beacon while out → check in (enter event + notification)
 *  - a beacon at another location while in → check in there (the server closes the previous one)
 *  - a beacon at the same location → "still seen"; zone beacons never split a registration
 *  - no beacon of the current location for the grace period → check out, timestamped at the last sighting
 * Unlike iOS, the grace period is applied before anything is emitted, so there is no pending exit.
 */
object TimoCore {
  data class Beacon(val minor: Int, val locationId: String?, val location: String, val spot: String)
  data class Inside(val minor: Int, val locationId: String?, val location: String, val spot: String, val since: Long, var lastSeen: Long)

  private const val PREFS = "timo.engine"
  const val CH_IN = "timo_checkin"
  const val CH_OUT = "timo_checkout"
  const val CH_SILENT = "timo_presence_silent"
  const val CH_SERVICE = "timo_service"
  private const val SEQ_EPOCH = 1_704_067_200_000L // 2024-01-01

  private val main = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()
  private lateinit var app: Context
  private var loaded = false

  var config: JSONObject? = null; private set
  var monitoring = false; private set
  var inside: Inside? = null; private set
  private var nextSeq = 0L
  private var queue = JSONArray()
  private var lastSyncAt: Long? = null
  private var lastSyncError: String? = null
  @Volatile private var uploading = false

  /** Whether an Activity of ours is in the foreground (set by the module). */
  @Volatile var foreground = false
  /** Emit to JS (set by the module while it is alive). */
  @Volatile var emit: ((String, Bundle) -> Unit)? = null

  @Synchronized
  fun init(context: Context) {
    if (loaded) return
    app = context.applicationContext
    val p = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    config = p.getString("config", null)?.let { JSONObject(it) }
    monitoring = p.getBoolean("monitoring", false)
    nextSeq = p.getLong("nextSeq", 0)
    queue = p.getString("queue", null)?.let { JSONArray(it) } ?: JSONArray()
    lastSyncAt = if (p.contains("lastSyncAt")) p.getLong("lastSyncAt", 0) else null
    lastSyncError = p.getString("lastSyncError", null)
    inside = p.getString("inside", null)?.let {
      val o = JSONObject(it)
      Inside(o.getInt("minor"), o.optString("locationId").ifEmpty { null }, o.getString("location"), o.getString("spot"), o.getLong("since"), o.getLong("lastSeen"))
    }
    loaded = true
    createChannels()
  }

  @Synchronized
  private fun save() {
    val i = inside
    app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("config", config?.toString())
      .putBoolean("monitoring", monitoring)
      .putLong("nextSeq", nextSeq)
      .putString("queue", queue.toString())
      .apply {
        if (lastSyncAt != null) putLong("lastSyncAt", lastSyncAt!!) else remove("lastSyncAt")
        putString("lastSyncError", lastSyncError)
        putString("inside", i?.let {
          JSONObject().put("minor", it.minor).put("locationId", it.locationId ?: "").put("location", it.location)
            .put("spot", it.spot).put("since", it.since).put("lastSeen", it.lastSeen).toString()
        })
      }
      .apply()
    emit?.invoke("onState", state())
  }

  // ───────────────────────── configuration ─────────────────────────

  val uuid: String? get() = config?.optString("uuid")?.lowercase()
  val major: Int get() = config?.optInt("major", -1) ?: -1
  val graceMs: Long get() = ((config?.optDouble("graceSeconds", 180.0) ?: 180.0) * 1000).toLong()

  fun beacon(minor: Int): Beacon? {
    val arr = config?.optJSONArray("beacons") ?: return null
    for (i in 0 until arr.length()) {
      val b = arr.getJSONObject(i)
      if (b.getInt("minor") == minor) {
        return Beacon(minor, if (b.isNull("locationId")) null else b.optString("locationId"), b.optString("location"), b.optString("spot"))
      }
    }
    return null
  }

  @Synchronized
  fun configure(c: JSONObject) {
    config = c
    inside?.let { if (beacon(it.minor) == null) inside = null }
    save()
    if (monitoring) TimoService.start(app)
  }

  @Synchronized
  fun setPreferences(sounds: Boolean?, notifications: Boolean?, strings: JSONObject?) {
    val c = config ?: return
    sounds?.let { c.put("sounds", it) }
    notifications?.let { c.put("notifications", it) }
    strings?.let { c.put("strings", it) }
    save()
    TimoService.refreshNotification(app)
  }

  @Synchronized
  fun start() {
    monitoring = true
    save()
    if (config != null) TimoService.start(app)
  }

  @Synchronized
  fun stop() {
    monitoring = false
    save()
    TimoService.stop(app)
  }

  @Synchronized
  fun reset() {
    stop()
    config = null
    inside = null
    queue = JSONArray()
    lastSyncAt = null
    lastSyncError = null
    save()
  }

  fun state(): Bundle {
    val i = inside
    return bundleOf(
      "configured" to (config != null),
      "monitoring" to monitoring,
      "inside" to i?.let { bundleOf("minor" to it.minor, "locationId" to it.locationId, "location" to it.location, "spot" to it.spot, "since" to it.since.toDouble(), "lastSeen" to it.lastSeen.toDouble()) },
      "pendingExit" to null,
      "queued" to queue.length(),
      "lastSyncAt" to lastSyncAt?.toDouble(),
      "lastSyncError" to lastSyncError,
    )
  }

  // ───────────────────────── engine ─────────────────────────

  private fun sameLocation(a: Inside, b: Beacon) = a.minor == b.minor || (a.locationId != null && a.locationId == b.locationId)

  @Synchronized
  fun seen(minor: Int, rssi: Int?, now: Long = System.currentTimeMillis()) {
    val c = config ?: return
    val b = beacon(minor) ?: return
    val cur = inside
    if (cur != null && sameLocation(cur, b)) {
      cur.lastSeen = now
      // Persist lastSeen at most every 20 s — it's only needed if the process dies.
      if (now - lastPersist > 20_000) { lastPersist = now; save() }
      return
    }
    val next = Inside(b.minor, b.locationId, b.location, b.spot, now, now)
    inside = next
    enqueue("enter", b.minor, now, rssi, c)
    save()
    announce("in", next, now, null)
    upload()
  }
  private var lastPersist = 0L

  /** Called by the service every few seconds: check out once the grace period has passed in silence. */
  @Synchronized
  fun tick(now: Long = System.currentTimeMillis()) {
    val c = config ?: return
    val cur = inside ?: return
    if (now - cur.lastSeen < graceMs) return
    enqueue("exit", cur.minor, cur.lastSeen, null, c)
    inside = null
    save()
    announce("out", cur, cur.lastSeen, cur.since)
    upload()
  }

  @Synchronized
  fun simulate(type: String, minor: Int) {
    if (type == "enter") { seen(minor, -60); return }
    val cur = inside ?: return
    // Simulated leave: backdate the last sighting so the grace check fires now.
    cur.lastSeen = System.currentTimeMillis() - graceMs
    tick()
  }

  private fun enqueue(type: String, minor: Int, at: Long, rssi: Int?, c: JSONObject) {
    // Seq only grows, even across a sign-out: floor it at seconds since 2024.
    nextSeq = maxOf(nextSeq + 1, (System.currentTimeMillis() - SEQ_EPOCH) / 1000)
    queue.put(JSONObject().put("seq", nextSeq).put("type", type).put("uuid", c.optString("uuid").uppercase())
      .put("major", c.optInt("major")).put("minor", minor).put("at", iso(at)).put("rssi", rssi ?: JSONObject.NULL))
    while (queue.length() > 2000) queue.remove(0)
  }

  private fun iso(ms: Long): String {
    val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    f.timeZone = TimeZone.getTimeZone("UTC")
    return f.format(Date(ms))
  }

  private fun announce(type: String, i: Inside, at: Long, since: Long?) {
    val fg = foreground && emit != null
    if (!fg) postNotification(type, i, at, since)
    val payload = bundleOf("type" to type, "minor" to i.minor, "location" to i.location, "spot" to i.spot, "at" to at.toDouble(), "since" to since?.toDouble(), "foreground" to fg)
    main.post { emit?.invoke("onPresence", payload) }
  }

  // ───────────────────────── notifications ─────────────────────────

  private fun soundUri(name: String) = Uri.parse("android.resource://${app.packageName}/raw/$name")

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
    // A channel's sound is fixed at creation, hence one per chime plus a silent one for "sounds off".
    nm.createNotificationChannel(NotificationChannel(CH_IN, "Check-in", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "A notification and a rising chime when your time registration starts."
      setSound(soundUri("timo_checkin"), attrs)
    })
    nm.createNotificationChannel(NotificationChannel(CH_OUT, "Check-out", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "A notification and a falling chime when your time registration stops."
      setSound(soundUri("timo_checkout"), attrs)
    })
    nm.createNotificationChannel(NotificationChannel(CH_SILENT, "Check-in and check-out (silent)", NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
    })
    nm.createNotificationChannel(NotificationChannel(CH_SERVICE, "Beacon detection", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shown while Timo listens for workplace beacons."
      setShowBadge(false)
    })
  }

  fun strings(): JSONObject = config?.optJSONObject("strings") ?: JSONObject()

  private fun postNotification(type: String, i: Inside, at: Long, since: Long?) {
    val c = config ?: return
    if (!c.optBoolean("notifications", true)) return
    val s = strings()
    val hm = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(at))
    val duration = since?.let {
      val mins = maxOf(0L, Math.round((at - it) / 60_000.0))
      "${mins / 60}${s.optString("hoursUnit", "h")} ${String.format(Locale.US, "%02d", mins % 60)}${s.optString("minutesUnit", "m")}"
    } ?: ""
    fun fill(t: String) = t.replace("{location}", i.location).replace("{spot}", i.spot).replace("{time}", hm).replace("{duration}", duration)
    val title = fill(s.optString(if (type == "in") "inTitle" else "outTitle", if (type == "in") "Checked in · {location}" else "Checked out · {location}"))
    val body = fill(s.optString(if (type == "in") "inBody" else "outBody", ""))
    val channel = if (!c.optBoolean("sounds", true)) CH_SILENT else if (type == "in") CH_IN else CH_OUT
    val launch = app.packageManager.getLaunchIntentForPackage(app.packageName)
    val open = launch?.let { PendingIntent.getActivity(app, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val n = NotificationCompat.Builder(app, channel)
      .setSmallIcon(R.drawable.ic_timo_stat)
      .setColor(0xFF5980A6.toInt())
      .setContentTitle(title)
      .setContentText(body)
      .setWhen(at)
      .setShowWhen(true)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .apply { if (open != null) setContentIntent(open) }
      .build()
    try {
      NotificationManagerCompat.from(app).notify(if (type == "in") 7101 else 7102, n)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS not granted — the registration still happens.
    }
  }

  // ───────────────────────── upload ─────────────────────────

  fun upload(done: (() -> Unit)? = null) {
    val c = config
    if (c == null || queue.length() == 0 || uploading) { done?.let { main.post(it) }; return }
    uploading = true
    val batch = JSONArray()
    synchronized(this) { for (i in 0 until minOf(200, queue.length())) batch.put(queue.getJSONObject(i)) }
    io.execute {
      var error: String? = null
      var ack = -1L
      try {
        val conn = URL("${c.optString("apiUrl")}/api/events").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${c.optString("token")}")
        conn.outputStream.use { it.write(JSONObject().put("deviceId", c.optString("deviceId")).put("events", batch).toString().toByteArray()) }
        val code = conn.responseCode
        if (code in 200..299) {
          val body = conn.inputStream.bufferedReader().use { it.readText() }
          ack = JSONObject(body).optLong("ackSeq", -1)
        } else {
          error = "HTTP $code"
        }
        conn.disconnect()
      } catch (e: Exception) {
        error = e.message ?: e.javaClass.simpleName
      }
      synchronized(this) {
        if (error == null) {
          val sent = HashSet<Long>()
          for (i in 0 until batch.length()) sent.add(batch.getJSONObject(i).getLong("seq"))
          val keep = JSONArray()
          for (i in 0 until queue.length()) {
            val e = queue.getJSONObject(i)
            val seq = e.getLong("seq")
            if (!sent.contains(seq) && seq > ack) keep.put(e)
          }
          queue = keep
          lastSyncAt = System.currentTimeMillis()
        }
        lastSyncError = error
        uploading = false
      }
      main.post {
        save()
        if (error == null && queue.length() > 0) upload(done) else done?.invoke()
      }
    }
  }
}
