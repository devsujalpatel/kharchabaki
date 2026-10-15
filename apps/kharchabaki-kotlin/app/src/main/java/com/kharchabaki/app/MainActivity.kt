package com.kharchabaki.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.DisposableEffect
import androidx.core.view.WindowCompat
import androidx.core.net.toUri
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.kharchabaki.app.ui.KharchabakiApp
import com.kharchabaki.app.ui.ToolsScreen
import com.kharchabaki.app.ui.loanMessageBody
import java.time.LocalDate
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var model: AppViewModel
    private val exportJson = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri -> uri?.let { model.exportDocument(it, true) } }
    private val exportCsv = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri -> uri?.let { model.exportDocument(it, false) } }
    private val importJson = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { model.importDocument(it, true) } }
    private val importCsv = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { model.importDocument(it, false) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        model = ViewModelProvider(this)[AppViewModel::class.java]
        setContent {
            val state = model.state.collectAsStateWithLifecycle().value
            DisposableEffect(state.finance.preferences.theme) {
                val light = state.finance.preferences.theme in setOf("light", "rose")
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    isAppearanceLightStatusBars = light
                    isAppearanceLightNavigationBars = light
                }
                onDispose { }
            }
            KharchabakiApp(state, model::onAction) { route, onBack ->
                ToolsScreen(route, state.finance, state.loading, onBack, model::onToolAction)
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                model.events.collect { event ->
                    try {
                        when (event) {
                            is UiEvent.OpenBrowser -> startActivity(Intent(Intent.ACTION_VIEW, event.url.toUri()).addCategory(Intent.CATEGORY_BROWSABLE))
                            is UiEvent.ComposeMessage -> {
                                val uri = Uri.fromParts("smsto", event.phoneNumber, null)
                                val intent = Intent(Intent.ACTION_SENDTO, uri)
                                    .putExtra("sms_body", loanMessageBody)
                                startActivity(intent)
                            }
                            is UiEvent.Export -> if (event.json) exportJson.launch("kharchabaki-${LocalDate.now()}.json") else exportCsv.launch("kharchabaki-${LocalDate.now()}.csv")
                            is UiEvent.Import -> if (event.json) importJson.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) else importCsv.launch(arrayOf("text/*", "application/csv", "application/vnd.ms-excel", "application/octet-stream"))
                        }
                    } catch (error: Exception) { model.reportExternalError(error.message ?: "No app is available to open this action.") }
                }
            }
        }
        intent?.data?.let { uri -> model.onOAuthCallback(uri); intent.data = null }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let { uri -> model.onOAuthCallback(uri); intent.data = null }
    }

    override fun onResume() {
        super.onResume()
        if (::model.isInitialized) model.onResume()
    }
}
