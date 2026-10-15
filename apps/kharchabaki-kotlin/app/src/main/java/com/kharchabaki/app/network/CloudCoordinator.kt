package com.kharchabaki.app.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.SystemClock
import com.kharchabaki.app.BuildConfig
import com.kharchabaki.app.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.io.Closeable
import java.io.IOException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/** Serializes account transitions and network writes; repository tokens also guard late snapshot results. */
class CloudCoordinator(context: Context, private val repository: FinanceRepository) : Closeable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val operations = Mutex()
    private val store = SecureSessionStore(context.applicationContext)
    private val api by lazy { ApiClient(BuildConfig.API_BASE_URL, store) }
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val mutable = MutableStateFlow(CloudState(online = connected()))
    val state: StateFlow<CloudState> = mutable.asStateFlow()
    private var started = false
    private var lastRefreshAt = 0L
    private var lastRefreshSucceeded = false
    private var syncJob: Job? = null
    private var networkRegistered = false
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = connectionChanged()
        override fun onLost(network: Network) = connectionChanged()
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = connectionChanged()
    }

    init {
        runCatching { connectivity?.registerDefaultNetworkCallback(networkCallback); networkRegistered = connectivity != null }
        scope.launch {
            repository.state.map { it.outbox.map { mutation -> mutation.id } }.distinctUntilChanged().collect {
                if (it.isNotEmpty()) requestSync()
            }
        }
        scope.launch {
            while (isActive) {
                delay(30_000)
                if (state.value.session?.valid == false) operations.withLock {
                    if (state.value.session?.valid == false) expireLocked()
                }
                else if (connected() && repository.state.value.outbox.isNotEmpty()) requestSync()
            }
        }
    }

    private suspend fun <T> serialized(block: suspend () -> T): T = withContext(Dispatchers.IO) {
        operations.withLock { block() }
    }

    suspend fun startup() = serialized {
        if (started) return@serialized
        started = true
        try {
            val identity = store.read("identity")?.let { authJson.decodeFromString<SessionIdentity>(it) }
            if (identity != null && validIdentity(identity) && identity.valid) activateLocked(identity)
            else if (identity != null) expireLocked()
            mutable.update { it.copy(starting = false) }
            if (state.value.session?.localOnly == false && state.value.online) scope.launch { refreshIfStale() }
        } catch (error: Exception) { reportLocked(error) }
        finally { mutable.update { it.copy(starting = false, verifying = false, syncing = false) } }
    }

    suspend fun startOffline() = serialized {
        api.clearCookies()
        store.write("oauth", null)
        activateLocked(SessionIdentity("local:device", "On this device", "", isPremium = false,
            sessionId = "device-only", expiresAt = "9999-12-31T23:59:59.999Z", localOnly = true))
        mutable.update { it.copy(starting = false, verifying = false, reason = null, error = null) }
    }

    suspend fun login(email: String, password: String) = serialized {
        require(email.isNotBlank() && password.isNotBlank()) { "Enter your email and password." }
        mutable.update { it.copy(verifying = true, error = null) }
        try {
            requireConnection()
            api.request("/api/auth/sign-in/email", "POST", buildJsonObject {
                put("email", email.trim()); put("password", password)
            })
            // Credentials can represent another account: never verify with the previous account header.
            repository.deactivate()
            mutable.update { it.copy(session = null) }
            store.write("identity", null)
            verifyLocked()
            if (state.value.session?.isPremium == true) syncLocked()
        } catch (error: Exception) { reportLocked(error); throw error }
        finally { mutable.update { it.copy(verifying = false) } }
    }

    /** Matches the installed Better Auth Expo plugin, including its browser cookie bridge. */
    suspend fun startGoogle(): String = serialized {
        mutable.update { it.copy(error = null) }
        try {
            requireConnection()
            val nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also { SecureRandom().nextBytes(it) })
            store.write("oauth", authJson.encodeToString(PendingOAuth(nonce, System.currentTimeMillis())))
            val callback = "kharchabaki://kotlin-auth?nonce=$nonce"
            val response = api.request("/api/auth/sign-in/social", "POST", buildJsonObject {
                put("provider", "google"); put("callbackURL", callback)
                put("errorCallbackURL", callback); put("disableRedirect", true)
            }).objectValue()
            val authorization = response.requiredString("url").toHttpUrl()
            require(authorization.isHttps && authorization.host == "accounts.google.com") { "Unexpected Google sign-in URL." }
            api.base.newBuilder().encodedPath("/api/auth/expo-authorization-proxy")
                .addQueryParameter("authorizationURL", authorization.toString()).apply {
                    api.oauthState()?.let { addQueryParameter("oauthState", it) }
                }.build().toString()
        } catch (error: Exception) {
            store.write("oauth", null); reportLocked(error); throw error
        }
    }

    suspend fun handleOAuthCallback(uri: Uri): Boolean = serialized {
        if (uri.scheme != "kharchabaki" || uri.host != "kotlin-auth" || !uri.path.isNullOrEmpty()) return@serialized false
        val pending = store.read("oauth")?.let { runCatching { authJson.decodeFromString<PendingOAuth>(it) }.getOrNull() }
            ?: return@serialized false
        val parameters = decodeOAuthQuery(uri.encodedQuery)
        val nonces = parameters["nonce"].orEmpty()
        if (nonces.size != 1 || System.currentTimeMillis() !in pending.createdAt..(pending.createdAt + 600_000) ||
            !MessageDigest.isEqual(nonces.single().toByteArray(), pending.nonce.toByteArray())) return@serialized false
        store.write("oauth", null) // Consume once, before processing any cookie material.
        try {
            val errors = parameters["error"].orEmpty()
            require(errors.isEmpty()) { "Google sign-in was cancelled or denied. Please try again." }
            val cookies = parameters["cookie"].orEmpty()
            require(cookies.size == 1) { "Google sign-in did not return a session. Please try again." }
            api.importCallbackCookies(cookies.single())
            repository.deactivate()
            store.write("identity", null)
            mutable.update { it.copy(session = null, verifying = true, error = null) }
            verifyLocked()
            if (state.value.session?.isPremium == true) syncLocked()
            true
        } catch (error: Exception) { reportLocked(error); throw error }
        finally { mutable.update { it.copy(verifying = false) } }
    }

    suspend fun logout() = serialized {
        try { if (state.value.session?.localOnly == false) api.request("/api/auth/sign-out", "POST") }
        catch (_: IOException) { /* Local sign-out must work without a connection. */ }
        catch (_: ApiException) { /* The server session may already have expired. */ }
        finally { expireLocked(null) }
    }

    suspend fun refresh() = serialized { refreshLocked() }

    suspend fun refreshIfStale() = serialized {
        if (!lastRefreshSucceeded || SystemClock.elapsedRealtime() - lastRefreshAt >= 60_000) refreshLocked()
    }

    private suspend fun refreshLocked() {
        lastRefreshSucceeded = false
        try {
            if (state.value.session?.valid == false) expireLocked()
            else if (state.value.session?.localOnly == false) {
                verifyLocked()
                if (state.value.session?.isPremium == true) syncLocked()
                lastRefreshAt = SystemClock.elapsedRealtime()
                lastRefreshSucceeded = state.value.online
            }
        } catch (error: Exception) { reportLocked(error) }
    }

    suspend fun sync(month: String = currentMonth()) = serialized {
        require(Regex("\\d{4}-(0[1-9]|1[0-2])").matches(month)) { "Choose a valid month." }
        try {
            if (state.value.session?.valid == false) expireLocked()
            else if (state.value.session?.localOnly == false) {
                verifyLocked()
                syncLocked(month)
            }
        } catch (error: Exception) { reportLocked(error) }
    }

    /** Recovery reads canonical data first; a failed read leaves every pending change intact. */
    suspend fun discardPending(expectedWorkspaceToken: Long) = serialized {
        requireWorkspace(expectedWorkspaceToken)
        val prior = repository.state.value
        mutable.update { it.copy(syncing = true, error = null) }
        try {
            verifyLocked()
            requireWorkspace(expectedWorkspaceToken)
            val identity = state.value.session
            require(identity != null && identity.isPremium && !identity.localOnly && identity.valid) {
                "Connect a Premium account to reload cloud data."
            }
            val month = currentMonth()
            val months = (prior.budgets.map { it.month } + prior.outbox.filter {
                it.path == "/budgets" || it.path.startsWith("/budgets/")
            }.mapNotNull { it.body["month"]?.jsonPrimitive?.contentOrNull } + month).distinct()
            // Empty prior caches prevent discarded optimistic budgets/rules surviving reconciliation.
            val fetched = fetchSnapshot(api, identity.userId, month, emptyList(), emptyList())
            val budgets = fetched.snapshot.budgets.toMutableList()
            for (otherMonth in months.filter { it != month }) {
                require(Regex("\\d{4}-(0[1-9]|1[0-2])").matches(otherMonth)) { "Invalid saved budget month." }
                val response = api.request("/api/v1/budgets?month=$otherMonth", accountId = identity.userId).objectValue()
                budgets += parseCloudBudgets(response["data"] ?: throw IOException("Missing cloud budgets."))
            }
            requireWorkspace(expectedWorkspaceToken)
            check(repository.discardPendingAndApplySnapshot(fetched.snapshot.copy(budgets = budgets),
                expectedWorkspaceToken, prior.outbox.map { it.id })) { "The account changed. Please reopen this action." }
            mutable.update { it.copy(online = true, error = fetched.recurringError) }
        } catch (error: Exception) { reportLocked(error); throw error }
        finally { mutable.update { it.copy(syncing = false) } }
    }

    /** Premium-only actions without a server idempotency contract require a live connection. */
    suspend fun mutate(path: String, method: String = "POST", body: JsonObject = buildJsonObject {}, expectedWorkspaceToken: Long? = null): Unit = serialized {
        require(validAuxiliaryPath(path, method)) { "Unsupported cloud operation." }
        try {
            requireWorkspace(expectedWorkspaceToken)
            verifyLocked()
            requireWorkspace(expectedWorkspaceToken)
            val session = state.value.session
            require(session != null && !session.localOnly && session.isPremium && session.valid) { "Connect a Premium account to sync this change." }
            // Earlier offline ledger writes must settle before balance-affecting auxiliary changes.
            syncLocked()
            requireWorkspace(expectedWorkspaceToken)
            require(repository.state.value.outbox.isEmpty()) { "Resolve the pending sync error before changing cloud data." }
            api.request("/api/v1$path", method, body, session.userId)
            // The write succeeded. A later read failure must not invite a duplicate payment/loan.
            try { syncLocked() } catch (error: Exception) { reportLocked(error) }
        } catch (error: Exception) { reportLocked(error); throw error }
    }

    private suspend fun verifyLocked() {
        if (state.value.session?.localOnly == true) return
        mutable.update { it.copy(verifying = true) }
        try {
            requireConnection()
            // Calling Better Auth directly forwards renewal Set-Cookie headers. The custom /me
            // middleware can extend a database session without forwarding those cookies itself.
            if (api.request("/api/auth/get-session") == JsonNull)
                throw ApiException(401, "Your session expired. Sign in again.")
            val envelope = api.request("/api/v1/me", accountId = state.value.session?.userId).objectValue()
            val payload = envelope["data"].objectValue()["session"].objectValue()
            val user = payload["user"].objectValue()
            val session = payload["session"].objectValue()
            val identity = SessionIdentity(user.requiredString("id"), user.string("name"), user.string("email"),
                user.nullableString("image"), user.boolean("isPremium"), session.requiredString("id"), session.requiredString("expiresAt"))
            if (!identity.valid || !validIdentity(identity)) { expireLocked(); return }
            activateLocked(identity)
            mutable.update { it.copy(online = true, error = null, reason = null) }
        } finally { mutable.update { it.copy(verifying = false) } }
    }

    private suspend fun activateLocked(identity: SessionIdentity) {
        store.write("identity", authJson.encodeToString(identity)) // Snapshot contains no cookie/token.
        val prior = state.value.session
        if (prior == null || prior.userId != identity.userId || prior.isPremium != identity.isPremium || prior.localOnly != identity.localOnly || !repository.state.value.ready)
            repository.activate(identity.userId, identity.isPremium && !identity.localOnly)
        mutable.update { it.copy(session = identity, starting = false, reason = null, error = null) }
    }

    private suspend fun syncLocked(month: String = currentMonth()) {
        val identity = state.value.session ?: return
        if (identity.localOnly || !identity.isPremium || !identity.valid) return
        val token = repository.state.value.workspaceToken
        mutable.update { it.copy(syncing = true, error = null) }
        try {
            while (true) {
                val finance = repository.state.value
                if (finance.workspaceToken != token || !finance.premium) return
                val mutation = finance.outbox.firstOrNull() ?: break
                if (!repository.markMutationAttempted(mutation.id, token)) return
                var responseData: JsonObject? = null
                try {
                    val response = api.request("/api/v1${mutation.path}", mutation.method, mutation.body, identity.userId)
                    responseData = (response as? JsonObject)?.get("data") as? JsonObject
                } catch (error: ApiException) {
                    if (!(error.status == 404 && mutation.method == "DELETE")) {
                        if (error.status in 400..499 && error.status != 401 && error.status != 403)
                            repository.markMutationError(mutation.id, error.message, token)
                        throw error
                    }
                }
                if (!repository.acknowledgeMutation(mutation.id, token, responseData)) return
            }
            val previous = repository.state.value
            val fetched = fetchSnapshot(api, identity.userId, month, previous.budgets, previous.recurring)
            repository.applyRemoteSnapshot(fetched.snapshot, token)
            mutable.update { it.copy(online = true, error = fetched.recurringError) }
        } finally { mutable.update { it.copy(syncing = false) } }
    }

    private suspend fun expireLocked(reason: String? = "expired") {
        store.write("identity", null)
        store.write("oauth", null)
        api.clearCookies()
        repository.deactivate()
        mutable.update { it.copy(session = null, starting = false, verifying = false, syncing = false, reason = reason, error = null) }
    }

    private suspend fun reportLocked(error: Exception) {
        if (error is CancellationException) throw error
        when {
            error is ApiException && error.status == 401 -> expireLocked(if (state.value.session == null) null else "expired")
            error is ApiException && error.status == 403 -> {
                state.value.session?.takeIf { !it.localOnly }?.let { activateLocked(it.copy(isPremium = false)) }
                mutable.update { it.copy(error = error.message, syncing = false) }
            }
            error is IOException -> {
                if (state.value.session?.valid == false) expireLocked()
                mutable.update { it.copy(online = false, error = "Connection unavailable. Your saved data and pending changes are on this device.") }
            }
            else -> mutable.update { it.copy(error = error.message ?: "Could not complete the request.") }
        }
    }

    private fun connectionChanged() {
        val online = connected()
        val before = state.value.online
        mutable.update { it.copy(online = online) }
        if (online && !before && !state.value.starting) scope.launch { refresh() }
    }
    private fun connected(): Boolean = runCatching {
        val network = connectivity?.activeNetwork ?: return@runCatching false
        connectivity.getNetworkCapabilities(network)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }.getOrDefault(false)

    private fun requireConnection() {
        if (!connected()) throw IOException("No network connection")
    }

    private fun requireWorkspace(expected: Long?) {
        require(expected == null || (repository.state.value.ready && repository.state.value.workspaceToken == expected)) {
            "The account or storage mode changed. Please reopen this action."
        }
    }

    @Synchronized private fun requestSync() {
        if (syncJob?.isActive == true || state.value.session?.isPremium != true || state.value.session?.localOnly != false) return
        syncJob = scope.launch { sync() }
    }

    private fun validIdentity(value: SessionIdentity) = value.userId.isNotBlank() && value.sessionId.isNotBlank() &&
        (!value.localOnly || (value.userId == "local:device" && value.sessionId == "device-only" && !value.isPremium))

    private fun validAuxiliaryPath(path: String, method: String): Boolean {
        val uuid = "[a-fA-F0-9-]{36}"
        return when (method) {
            "POST" -> path in setOf("/balance", "/loans/taken", "/loans/given", "/budgets", "/finance-labels", "/recurring", "/recurring/run") ||
                Regex("/loans/(taken|given)/$uuid/payments").matches(path)
            "PATCH" -> Regex("/(loans/(taken|given)|finance-labels|recurring)/$uuid").matches(path)
            "DELETE" -> Regex("/(loans/(taken|given)|budgets|recurring)/$uuid").matches(path)
            else -> false
        }
    }

    override fun close() {
        if (networkRegistered) runCatching { connectivity?.unregisterNetworkCallback(networkCallback) }
        scope.cancel()
    }
}

internal fun JsonElement?.objectValue(): JsonObject = this as? JsonObject ?: throw IOException("Invalid response from server.")
internal fun JsonObject.string(key: String, fallback: String = ""): String = (get(key) as? JsonPrimitive)?.contentOrNull ?: fallback
internal fun JsonObject.requiredString(key: String) = string(key).also { require(it.isNotBlank()) { "The server returned an incomplete $key." } }
internal fun JsonObject.nullableString(key: String) = (get(key) as? JsonPrimitive)?.contentOrNull
internal fun JsonObject.boolean(key: String, fallback: Boolean = false) = (get(key) as? JsonPrimitive)?.booleanOrNull ?: fallback
