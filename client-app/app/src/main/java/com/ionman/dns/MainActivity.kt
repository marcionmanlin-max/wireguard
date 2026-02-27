package com.ionman.dns

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import org.json.JSONObject
import java.io.File
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: android.content.SharedPreferences
    private lateinit var statusIcon: ImageView
    private lateinit var statusText: TextView
    private lateinit var subscriberName: TextView
    private lateinit var serverUrl: TextView
    private lateinit var expiresText: TextView
    private lateinit var planBadge: TextView
    private lateinit var btnConnect: Button
    private lateinit var btnDisconnect: Button
    private lateinit var btnSettings: ImageButton
    private lateinit var btnLogout: Button
    private lateinit var btnRenew: Button
    private lateinit var statsLayout: LinearLayout
    private lateinit var expiredCard: LinearLayout
    private lateinit var vpnHint: TextView
    private lateinit var uploadText: TextView
    private lateinit var downloadText: TextView

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("ionman_dns", MODE_PRIVATE)

        // Not logged in → setup
        if (!prefs.contains("sub_token")) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        statusIcon = findViewById(R.id.statusIcon)
        statusText = findViewById(R.id.statusText)
        subscriberName = findViewById(R.id.subscriberName)
        serverUrl = findViewById(R.id.serverUrl)
        expiresText = findViewById(R.id.expiresText)
        planBadge = findViewById(R.id.planBadge)
        btnConnect = findViewById(R.id.btnConnect)
        btnDisconnect = findViewById(R.id.btnDisconnect)
        btnSettings = findViewById(R.id.btnSettings)
        btnLogout = findViewById(R.id.btnLogout)
        btnRenew = findViewById(R.id.btnRenew)
        statsLayout = findViewById(R.id.statsLayout)
        expiredCard = findViewById(R.id.expiredCard)
        vpnHint = findViewById(R.id.vpnHint)
        uploadText = findViewById(R.id.uploadText)
        downloadText = findViewById(R.id.downloadText)

        // Display saved info
        subscriberName.text = prefs.getString("name", "")
        serverUrl.text = prefs.getString("server_url", "")
        planBadge.text = (prefs.getString("plan", "trial") ?: "trial").uppercase()

        // Button listeners
        btnConnect.setOnClickListener { fetchConfigAndImport() }
        btnDisconnect.setOnClickListener { openWireGuardApp() }
        btnSettings.setOnClickListener {
            startActivity(Intent(this, SetupActivity::class.java))
        }
        btnLogout.setOnClickListener { logout() }
        btnRenew.setOnClickListener {
            val url = "${prefs.getString("server_url", "")}/dns/subscribe"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }

        // Auto-import on first login if subscription is active
        if (intent.getBooleanExtra("auto_import", false)) {
            val config = prefs.getString("wg_config", "")
            if (!config.isNullOrEmpty()) {
                importWireGuardConfig(config)
            }
        }

        checkSubscriptionStatus()
    }

    private fun checkSubscriptionStatus() {
        val url = prefs.getString("server_url", "") ?: return
        val token = prefs.getString("sub_token", "") ?: return

        val request = Request.Builder()
            .url("$url/dns/api/subscribe/status")
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread { setStatus(false, "Cannot reach server") }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: "{}"
                runOnUiThread {
                    if (response.isSuccessful) {
                        try {
                            val json = JSONObject(body)
                            val active = json.optBoolean("active", false)
                            val status = json.optString("status", "expired")
                            val remaining = json.optString("remaining_text", "")
                            val expires = json.optString("expires", "")
                            val sub = json.optJSONObject("subscriber")

                            // Update stored state
                            prefs.edit().apply {
                                putBoolean("active", active)
                                putString("status", status)
                                putString("expires", expires)
                                apply()
                            }

                            if (sub != null) {
                                subscriberName.text = "${sub.optString("name", "")} (${sub.optString("plan", "")})"
                            }

                            if (active) {
                                setStatus(true, "VPN Ready — $remaining remaining")
                                planBadge.text = status.uppercase()
                                planBadge.setBackgroundColor(0xFF00D4FF.toInt())
                                expiredCard.visibility = View.GONE
                                btnConnect.visibility = View.VISIBLE
                                vpnHint.text = "Tap 'Connect VPN' to get your WireGuard config."

                                if (expires.isNotEmpty()) {
                                    expiresText.text = "Expires: $expires"
                                    expiresText.visibility = View.VISIBLE
                                }
                            } else {
                                setStatus(false, "Subscription Expired")
                                planBadge.text = "EXPIRED"
                                planBadge.setBackgroundColor(0xFFFF073A.toInt())
                                expiredCard.visibility = View.VISIBLE
                                btnConnect.visibility = View.GONE
                                btnDisconnect.visibility = View.GONE
                            }
                        } catch (e: Exception) {
                            setStatus(false, "Error: ${e.message}")
                        }
                    } else if (response.code == 401) {
                        setStatus(false, "Session expired")
                        planBadge.text = "LOGIN REQUIRED"
                        planBadge.setBackgroundColor(0xFF444444.toInt())
                        // Auto redirect to login
                        prefs.edit().remove("sub_token").apply()
                        startActivity(Intent(this@MainActivity, SetupActivity::class.java))
                        finish()
                    } else {
                        setStatus(false, "Server error (${response.code})")
                    }
                }
            }
        })
    }

    private fun fetchConfigAndImport() {
        val url = prefs.getString("server_url", "") ?: return
        val token = prefs.getString("sub_token", "") ?: return

        btnConnect.isEnabled = false
        btnConnect.text = "Fetching config..."

        val request = Request.Builder()
            .url("$url/dns/api/subscribe/config")
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    btnConnect.isEnabled = true
                    btnConnect.text = "Connect VPN"
                    Toast.makeText(this@MainActivity, "Failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: "{}"
                runOnUiThread {
                    btnConnect.isEnabled = true
                    btnConnect.text = "Connect VPN"

                    if (response.isSuccessful) {
                        try {
                            val json = JSONObject(body)
                            val config = json.optString("config", "")
                            if (config.isNotEmpty()) {
                                prefs.edit().putString("wg_config", config).apply()
                                importWireGuardConfig(config)
                            } else {
                                Toast.makeText(this@MainActivity, "No config received", Toast.LENGTH_LONG).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                        }
                    } else if (response.code == 403) {
                        Toast.makeText(this@MainActivity, "Subscription expired — please renew", Toast.LENGTH_LONG).show()
                        expiredCard.visibility = View.VISIBLE
                    } else {
                        Toast.makeText(this@MainActivity, "Error (${response.code})", Toast.LENGTH_LONG).show()
                    }
                }
            }
        })
    }

    private fun importWireGuardConfig(config: String) {
        try {
            val name = "ionman-dns"
            val file = File(cacheDir, "$name.conf")
            file.writeText(config)

            val uri = androidx.core.content.FileProvider.getUriForFile(
                this, "${packageName}.fileprovider", file
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/x-wireguard-profile")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            if (intent.resolveActivity(packageManager) != null) {
                startActivity(intent)
                // Show disconnect button after importing
                btnConnect.visibility = View.GONE
                btnDisconnect.visibility = View.VISIBLE
                vpnHint.text = "Config imported! Toggle the tunnel ON in WireGuard app."
                statsLayout.visibility = View.VISIBLE
            } else {
                // WireGuard app not installed
                AlertDialog.Builder(this, R.style.AlertDialogTheme)
                    .setTitle("WireGuard App Required")
                    .setMessage("Install the WireGuard app to connect your VPN.\n\nYour config is ready — it will be imported automatically after installation.")
                    .setPositiveButton("Install WireGuard") { _, _ ->
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(
                            "https://play.google.com/store/apps/details?id=com.wireguard.android"
                        )))
                    }
                    .setNegativeButton("Copy Config") { _, _ ->
                        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("wg-config", config))
                        Toast.makeText(this, "Config copied to clipboard", Toast.LENGTH_SHORT).show()
                    }
                    .show()
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun openWireGuardApp() {
        try {
            val intent = packageManager.getLaunchIntentForPackage("com.wireguard.android")
            if (intent != null) {
                startActivity(intent)
            } else {
                Toast.makeText(this, "WireGuard app not installed", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Cannot open WireGuard", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setStatus(connected: Boolean, message: String) {
        statusText.text = message
        if (connected) {
            statusIcon.setColorFilter(0xFF00D4FF.toInt())
        } else {
            statusIcon.setColorFilter(0xFFFF073A.toInt())
        }
    }

    private fun logout() {
        AlertDialog.Builder(this, R.style.AlertDialogTheme)
            .setTitle("Sign Out")
            .setMessage("Sign out of your IonMan DNS account?")
            .setPositiveButton("Sign Out") { _, _ ->
                prefs.edit().clear().apply()
                startActivity(Intent(this, SetupActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                })
                finish()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format("%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format("%.1f MB", mb)
        val gb = mb / 1024.0
        return String.format("%.2f GB", gb)
    }

    override fun onResume() {
        super.onResume()
        if (prefs.contains("sub_token")) {
            checkSubscriptionStatus()
        }
    }
}
