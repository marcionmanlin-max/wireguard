package com.ionman.dns

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputEditText
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class SetupActivity : AppCompatActivity() {

    private lateinit var prefs: android.content.SharedPreferences
    private lateinit var serverInput: TextInputEditText
    private lateinit var emailInput: TextInputEditText
    private lateinit var passwordInput: TextInputEditText
    private lateinit var btnLogin: Button
    private lateinit var btnScan: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var errorText: TextView

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        prefs = getSharedPreferences("ionman_dns", MODE_PRIVATE)

        serverInput = findViewById(R.id.serverInput)
        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        btnLogin = findViewById(R.id.btnLogin)
        btnScan = findViewById(R.id.btnScan)
        progressBar = findViewById(R.id.progressBar)
        errorText = findViewById(R.id.errorText)

        // Pre-fill if returning
        serverInput.setText(prefs.getString("server_url", "https://server.makoyot.xyz"))
        emailInput.setText(prefs.getString("email", ""))

        btnLogin.setOnClickListener { login() }
        btnScan.setOnClickListener {
            startActivity(Intent(this, ScanActivity::class.java))
        }

        // Register link → opens subscribe page in browser
        findViewById<TextView>(R.id.btnRegister).setOnClickListener {
            val server = serverInput.text.toString().trim().trimEnd('/')
            val url = if (server.isNotEmpty()) "$server/dns/subscribe" else "https://server.makoyot.xyz/dns/subscribe"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun login() {
        var server = serverInput.text.toString().trim()
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            showError("Email and password are required")
            return
        }

        if (!server.startsWith("http")) server = "https://$server"
        server = server.trimEnd('/')

        errorText.visibility = View.GONE
        progressBar.visibility = View.VISIBLE
        btnLogin.isEnabled = false

        val jsonBody = JSONObject().apply {
            put("email", email)
            put("password", password)
        }

        val request = Request.Builder()
            .url("$server/dns/api/subscribe/login")
            .post(jsonBody.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val finalServer = server
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    progressBar.visibility = View.GONE
                    btnLogin.isEnabled = true
                    showError("Cannot connect: ${e.message}")
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: "{}"
                runOnUiThread {
                    progressBar.visibility = View.GONE
                    btnLogin.isEnabled = true

                    try {
                        val json = JSONObject(body)

                        if (response.isSuccessful) {
                            val token = json.optString("token", "")
                            if (token.isEmpty()) {
                                showError("Login failed: no token received")
                                return@runOnUiThread
                            }

                            prefs.edit().apply {
                                putString("server_url", finalServer)
                                putString("sub_token", token)
                                putString("email", email)
                                putString("name", json.optString("name", ""))
                                putString("plan", json.optString("plan", ""))
                                putString("status", json.optString("status", ""))
                                putBoolean("active", json.optBoolean("active", false))
                                putString("expires", json.optString("expires", ""))
                                val wgConfig = json.optString("wg_config", "")
                                if (wgConfig.isNotEmpty()) putString("wg_config", wgConfig)
                                apply()
                            }

                            val intent = Intent(this@SetupActivity, MainActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                                if (json.optString("wg_config", "").isNotEmpty() && json.optBoolean("active", false)) {
                                    putExtra("auto_import", true)
                                }
                            }
                            startActivity(intent)
                            finish()
                        } else {
                            showError(json.optString("error", "Login failed (${response.code})"))
                        }
                    } catch (e: Exception) {
                        showError("Error: ${e.message}")
                    }
                }
            }
        })
    }

    private fun showError(msg: String) {
        errorText.text = msg
        errorText.visibility = View.VISIBLE
    }
}
