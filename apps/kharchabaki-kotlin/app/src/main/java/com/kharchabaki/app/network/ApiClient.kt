package com.kharchabaki.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

internal val authJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }

internal class ApiClient(baseUrl: String, private val store: SecureSessionStore) {
    val base = baseUrl.trimEnd('/').toHttpUrl()
    private val jar = PersistentCookieJar(base, store)
    private val client = OkHttpClient.Builder().cookieJar(jar)
        .connectTimeout(12, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS).followRedirects(false).build()

    init {
        require(base.encodedPath == "/" && base.query == null && base.username.isEmpty() && base.password.isEmpty()) {
            "API_BASE_URL must be a server origin, for example https://api.example.com"
        }
        require(base.isHttps || base.host in setOf("10.0.2.2", "127.0.0.1", "localhost", "::1")) {
            "Use HTTPS for a remote API server. HTTP is only supported for local development."
        }
    }

    suspend fun request(path: String, method: String = "GET", body: JsonObject? = null,
        accountId: String? = null): JsonElement = withContext(Dispatchers.IO) {
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains(".."))
        val url = base.resolve(path) ?: error("Invalid API path")
        val builder = Request.Builder().url(url).header("Accept", "application/json")
            .header("expo-origin", "kharchabaki://").header("x-skip-oauth-proxy", "true")
        if (accountId != null) builder.header("X-Account-ID", accountId)
        if (body != null) body["clientMutationId"]?.jsonPrimitive?.contentOrNull?.let {
            builder.header("X-Client-Mutation-ID", it)
        }
        val requestBody = if (method == "GET" || method == "HEAD") null
            else (body?.toString() ?: "{}").toRequestBody("application/json; charset=utf-8".toMediaType())
        client.newCall(builder.method(method, requestBody).build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val parsed = runCatching { authJson.parseToJsonElement(raw) }.getOrElse { JsonNull }
            if (!response.isSuccessful) {
                val message = (parsed as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull
                    ?: when (response.code) {
                        401 -> "Your session expired. Sign in again."
                        403 -> "Cloud sync requires Premium. Your saved data is still on this device."
                        in 500..599 -> "The server is unavailable. Your changes are saved on this device."
                        else -> "Request failed (${response.code})."
                    }
                throw ApiException(response.code, message.take(500))
            }
            parsed
        }
    }

    fun clearCookies() = jar.clear()
    fun oauthState(): String? = jar.oauthState()
    fun importCallbackCookies(value: String) = jar.importCallbackCookies(value)
}

private class PersistentCookieJar(private val base: HttpUrl, private val store: SecureSessionStore) : CookieJar {
    private var cookies = runCatching {
        authJson.decodeFromString<List<String>>(store.read("cookies") ?: "[]").mapNotNull { Cookie.parse(base, it) }
    }.getOrDefault(emptyList())

    @Synchronized override fun saveFromResponse(url: HttpUrl, incoming: List<Cookie>) {
        if (url.host != base.host) return
        val next = cookies.toMutableList()
        for (cookie in incoming.filter(::owned)) {
            next.removeAll { it.name == cookie.name && it.path == cookie.path && it.domain == cookie.domain }
            if (cookie.expiresAt > System.currentTimeMillis()) next += cookie
        }
        cookies = next
        persist()
    }
    @Synchronized override fun loadForRequest(url: HttpUrl): List<Cookie> =
        if (url.host == base.host && url.port == base.port && url.scheme == base.scheme)
            cookies.filter { it.expiresAt > System.currentTimeMillis() && it.matches(url) } else emptyList()

    @Synchronized fun clear() { cookies = emptyList(); store.write("cookies", null) }
    @Synchronized fun oauthState(): String? = cookies.firstOrNull {
        normalizedAuthCookieName(it.name) == "better-auth.oauth_state" && it.expiresAt > System.currentTimeMillis()
    }?.value

    @Synchronized fun importCallbackCookies(value: String) {
        // Validate before replacing an existing account's cookies.
        val parsed = parseCallbackCookies(base, value)
        store.write("cookies", authJson.encodeToString(parsed.map(Cookie::toString)))
        cookies = parsed
    }
    private fun owned(cookie: Cookie) = isOwnedAuthCookie(base, cookie)
    private fun persist() = store.write("cookies", authJson.encodeToString(cookies.map(Cookie::toString)))
}
