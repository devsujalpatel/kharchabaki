package com.kharchabaki.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kharchabaki.app.data.*
import com.kharchabaki.app.network.CloudCoordinator
import com.kharchabaki.app.ui.AppAction
import com.kharchabaki.app.ui.AppUiState
import com.kharchabaki.app.ui.ToolAction
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

sealed interface UiEvent {
    data class OpenBrowser(val url: String) : UiEvent
    data class ComposeMessage(val phoneNumber: String) : UiEvent
    data class Export(val json: Boolean) : UiEvent
    data class Import(val json: Boolean) : UiEvent
}

private data class Feedback(val message: String? = null, val error: String? = null)
private data class DraftPreferences(val token: Long, val revision: Long, val value: Preferences)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = FinanceRepository(application)
    private val cloud = CloudCoordinator(application, repository)
    private val busy = MutableStateFlow(0)
    private val feedback = MutableStateFlow(Feedback())
    private val preferenceDraft = MutableStateFlow<DraftPreferences?>(null)
    private val preferenceWrites = Mutex()
    private val preferenceRevision = AtomicLong()
    private val exportTokens = ConcurrentHashMap<Boolean, Long>()
    private val importTokens = ConcurrentHashMap<Boolean, Long>()
    private val eventChannel = Channel<UiEvent>(Channel.BUFFERED)
    val events = eventChannel.receiveAsFlow()

    val state: StateFlow<AppUiState> = combine(repository.state, cloud.state, busy, feedback, preferenceDraft) { finance, connection, operations, note, draft ->
        val session = connection.session
        val visibleFinance = if (draft != null && draft.token == finance.workspaceToken) finance.copy(preferences = draft.value) else finance
        AppUiState(
            finance = visibleFinance,
            authenticated = session != null && session.valid,
            localOnly = session?.localOnly == true,
            displayName = session?.name.orEmpty(),
            email = session?.email.orEmpty(),
            loading = connection.starting || operations > 0,
            syncStatus = when {
                session?.localOnly == true -> "Saved on this device"
                session?.isPremium != true -> "Device storage · Free account"
                connection.syncing -> "Syncing…"
                finance.outbox.isNotEmpty() -> "${finance.outbox.size} pending · ${if (connection.online) "waiting to sync" else "offline"}"
                !connection.online -> "Offline · showing saved data"
                finance.lastSyncedAt == null -> "Cloud data has not synced yet"
                else -> "Premium · synced"
            },
            message = note.message,
            error = note.error ?: connection.error ?: if (connection.reason == "expired") "Your session expired. Sign in again; saved changes remain on this device." else null,
        )
    }.stateIn(viewModelScope, SharingStarted.Eagerly, AppUiState(loading = true))

    init {
        viewModelScope.launch(Dispatchers.IO) {
            try { cloud.startup() }
            catch (error: Exception) { report(error) }
        }
    }

    fun onAction(action: AppAction) {
        if (action == AppAction.DismissMessage) { feedback.value = Feedback(); return }
        if (action is AppAction.SavePreferences) { savePreferences(action.preferences); return }
        val token = repository.state.value.workspaceToken
        work(token) {
            when (action) {
                AppAction.StartOffline -> cloud.startOffline()
                AppAction.SignIn -> eventChannel.send(UiEvent.OpenBrowser(cloud.startGoogle()))
                is AppAction.EmailSignIn -> cloud.login(action.email, action.password)
                AppAction.SignOut -> cloud.logout()
                AppAction.Sync -> { cloud.refresh(); feedback.value = Feedback(message = "Refresh complete. ${cloud.state.value.error.orEmpty()}") }
                AppAction.DiscardPending -> { cloud.discardPending(token); saved("Pending changes discarded. Server records restored.") }
                is AppAction.SaveTransaction -> { ensureWorkspace(token); repository.saveTransaction(action.transaction); saved() }
                is AppAction.DeleteTransaction -> { ensureWorkspace(token); repository.deleteTransaction(action.id); saved("Transaction deleted") }
                is AppAction.SaveLoan -> {
                    ensureWorkspace(token)
                    val loan = action.loan
                    if (repository.state.value.premium) {
                        val exists = repository.state.value.loans.any { it.id == loan.id }
                        cloud.mutate("/loans/${loan.kind}" + if (exists) "/${loan.id}" else "", if (exists) "PATCH" else "POST", buildJsonObject {
                            put("amount", Money.decimal(loan.amountCents)); put("interest", Money.decimal(loan.interestBasisPoints.toLong()))
                            put("dueDate", loan.dueDate)
                            if (loan.kind == "taken") put("borrowedFrom", loan.person) else { put("borrowerName", loan.person); put("phoneNumber", loan.phoneNumber) }
                        }, expectedWorkspaceToken = token)
                    } else repository.saveLoan(loan)
                    saved()
                }
                is AppAction.DeleteLoan -> {
                    ensureWorkspace(token)
                    if (repository.state.value.premium) {
                        val loan = repository.state.value.loans.firstOrNull { it.id == action.id } ?: error("Loan not found.")
                        cloud.mutate("/loans/${loan.kind}/${loan.id}", "DELETE", expectedWorkspaceToken = token)
                    } else repository.deleteLoan(action.id)
                    saved("Loan deleted")
                }
                is AppAction.RecordPayment -> {
                    ensureWorkspace(token)
                    if (repository.state.value.premium) {
                        val loan = repository.state.value.loans.firstOrNull { it.id == action.id } ?: error("Loan not found.")
                        require(action.amountCents in 1..loan.remainingCents) { "Enter a payment no larger than the remaining amount." }
                        cloud.mutate("/loans/${loan.kind}/${loan.id}/payments", body = buildJsonObject { put("amount", Money.decimal(action.amountCents)); put("paidAt", utcNow()) }, expectedWorkspaceToken = token)
                    } else repository.recordLoanPayment(action.id, action.amountCents)
                    saved("Payment recorded")
                }
                is AppAction.MessageLoan -> eventChannel.send(UiEvent.ComposeMessage(action.phoneNumber))
                is AppAction.SetOpeningBalance -> {
                    ensureWorkspace(token)
                    if (repository.state.value.premium) cloud.mutate("/balance", body = buildJsonObject { putMoney("amount", action.cents) }, expectedWorkspaceToken = token)
                    else repository.setOpeningBalance(action.cents)
                    saved("Balance updated")
                }
                AppAction.DismissMessage, is AppAction.SavePreferences -> Unit
            }
        }
    }

    fun onToolAction(action: ToolAction) {
        val token = repository.state.value.workspaceToken
        work(token) {
            ensureWorkspace(token)
            val premium = repository.state.value.premium
            when (action) {
                is ToolAction.LoadMonth -> if (premium) cloud.sync(action.month)
                is ToolAction.SaveBudget -> {
                    repository.saveBudget(action.budget)
                    saved()
                }
                is ToolAction.DeleteBudget -> { repository.deleteBudget(action.id); saved("Budget deleted") }
                is ToolAction.SaveLabel -> {
                    repository.saveLabel(action.label)
                    saved()
                }
                is ToolAction.SaveRecurring -> {
                    repository.saveRecurring(action.rule)
                    saved()
                }
                is ToolAction.DeleteRecurring -> { repository.deleteRecurring(action.id); saved("Recurring rule deleted") }
                ToolAction.RunRecurring -> { if (premium) cloud.mutate("/recurring/run", expectedWorkspaceToken = token) else repository.runRecurring(); saved("Due recurring entries processed") }
                ToolAction.ExportCsv -> { exportTokens[false] = token; eventChannel.send(UiEvent.Export(false)) }
                ToolAction.ExportJson -> { exportTokens[true] = token; eventChannel.send(UiEvent.Export(true)) }
                ToolAction.ImportCsv -> { importTokens[false] = token; eventChannel.send(UiEvent.Import(false)) }
                ToolAction.ImportJson -> { importTokens[true] = token; eventChannel.send(UiEvent.Import(true)) }
            }
        }
    }

    private fun savePreferences(value: Preferences) {
        val token = repository.state.value.workspaceToken
        val revision = preferenceRevision.incrementAndGet()
        preferenceDraft.value = DraftPreferences(token, revision, value)
        viewModelScope.launch(Dispatchers.IO) {
            preferenceWrites.withLock {
                if (revision != preferenceRevision.get()) return@withLock
                try {
                    ensureWorkspace(token)
                    repository.withWorkspace(token) { repository.savePreferences(value) }
                    if (preferenceDraft.value?.revision == revision) preferenceDraft.value = null
                } catch (error: Exception) {
                    if (error is CancellationException) throw error
                    if (preferenceDraft.value?.revision == revision) preferenceDraft.value = null
                    report(error)
                }
            }
        }
    }

    fun onOAuthCallback(uri: Uri) = work { cloud.handleOAuthCallback(uri) }
    fun onResume() {
        if (!cloud.state.value.starting) viewModelScope.launch(Dispatchers.IO) {
            try {
                cloud.refreshIfStale()
                val finance = repository.state.value
                if (finance.ready && !finance.premium) repository.withWorkspace(finance.workspaceToken) { repository.runRecurring() }
            }
            catch (error: Exception) { report(error) }
        }
    }
    fun reportExternalError(message: String) { feedback.value = Feedback(error = message) }

    fun exportDocument(uri: Uri, json: Boolean) {
        val token = exportTokens.remove(json)
        if (token == null) { reportExternalError("Reopen export after restarting the app."); return }
        work(token) {
            ensureWorkspace(token)
            val text = if (json) repository.exportJson() else repository.exportCsv()
            getApplication<Application>().contentResolver.openOutputStream(uri, "wt")?.use { stream -> stream.write(text.toByteArray(Charsets.UTF_8)) }
                ?: error("Could not write the selected document.")
            saved("Export saved")
        }
    }

    fun importDocument(uri: Uri, json: Boolean) {
        val token = importTokens.remove(json)
        if (token == null) { reportExternalError("Reopen import after restarting the app."); return }
        work(token) {
            ensureWorkspace(token)
            require(!json || !repository.state.value.premium) { "Backup restore is available in device workspaces." }
            val text = getApplication<Application>().contentResolver.openInputStream(uri)?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 10 * 1024 * 1024) { "Choose a file smaller than 10 MB." }
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            } ?: error("Could not read the selected document.")
            ensureWorkspace(token)
            if (json) repository.importJson(text) else repository.importCsv(text)
            saved(if (json) "Workspace restored" else "CSV imported")
        }
    }

    private fun ensureWorkspace(token: Long) {
        require(repository.state.value.ready && repository.state.value.workspaceToken == token) { "The account changed. Please reopen this action." }
        require(cloud.state.value.session?.valid == true) { "Sign in again to access your saved workspace." }
    }
    private fun work(expectedWorkspaceToken: Long? = null, block: suspend () -> Unit) {
        busy.update { it + 1 }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                if (expectedWorkspaceToken != null) repository.withWorkspace(expectedWorkspaceToken) { block() } else block()
            }
            catch (error: Exception) { report(error) }
            finally { busy.update { (it - 1).coerceAtLeast(0) } }
        }
    }
    private fun saved(message: String = "Saved") { feedback.value = Feedback(message = message) }
    private fun report(error: Exception) {
        if (error is CancellationException) throw error
        feedback.value = Feedback(error = error.message ?: "Could not complete this action. Please retry.")
    }
    override fun onCleared() { cloud.close(); super.onCleared() }
}

private fun JsonObjectBuilder.putMoney(key: String, cents: Long) = put(key, JsonPrimitive(BigDecimal.valueOf(cents, 2)))
