package com.kharchabaki.app.network

import java.net.URLDecoder
import okhttp3.Cookie
import okhttp3.HttpUrl

/** Expo uses URLSearchParams (form encoding). Decode raw query components exactly once. */
internal fun decodeOAuthQuery(encodedQuery: String?): Map<String, List<String>> {
    if (encodedQuery.isNullOrEmpty()) return emptyMap()
    require(encodedQuery.length <= 256 * 1024) { "Invalid authentication callback." }
    return try {
        val parameters = mutableMapOf<String, MutableList<String>>()
        encodedQuery.split('&').filter(String::isNotEmpty).forEach { part ->
            val name = URLDecoder.decode(part.substringBefore('='), Charsets.UTF_8.name())
            val value = URLDecoder.decode(part.substringAfter('=', ""), Charsets.UTF_8.name())
            parameters.getOrPut(name) { mutableListOf() }.add(value)
        }
        parameters
    } catch (_: IllegalArgumentException) {
        // URLDecoder's original exception can include callback/session material.
        throw IllegalArgumentException("Invalid authentication callback.")
    }
}

internal fun normalizedAuthCookieName(name: String): String =
    name.removePrefix("__Secure-").removePrefix("__Host-")

internal fun isOwnedAuthCookie(base: HttpUrl, cookie: Cookie): Boolean =
    cookie.domain == base.host && normalizedAuthCookieName(cookie.name).startsWith("better-auth.")

/** Parse only a fully decoded header, preserving commas inside Expires dates. */
internal fun parseCallbackCookies(base: HttpUrl, value: String): List<Cookie> {
    require(value.length <= 65536) { "Invalid authentication callback." }
    val authUrl = requireNotNull(base.resolve("/api/auth/get-session"))
    val now = System.currentTimeMillis()
    val parsed = value.split(Regex(",(?=\\s*[^;,=\\s]+\\s*=)"))
        .mapNotNull { Cookie.parse(authUrl, it.trim()) }
        .filter { isOwnedAuthCookie(base, it) && it.matches(authUrl) && it.expiresAt > now }
    require(parsed.any { normalizedAuthCookieName(it.name) == "better-auth.session_token" && it.value.isNotEmpty() }) {
        "The sign-in callback did not contain a session. Try signing in again."
    }
    return parsed
}
