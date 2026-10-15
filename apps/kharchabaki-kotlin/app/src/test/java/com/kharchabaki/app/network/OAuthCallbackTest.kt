package com.kharchabaki.app.network

import java.net.URLEncoder
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test

class OAuthCallbackTest {
    private val base = "https://api.example.com".toHttpUrl()
    private val header = "__Secure-better-auth.oauth_state=; Max-Age=0; Path=/; Secure; HttpOnly, " +
        "__Secure-better-auth.session_token=token%2Bsig%3D; Path=/; Secure; HttpOnly; " +
        "Expires=Wed, 21 Oct 2099 07:28:00 GMT"

    @Test fun expoFormEncodedCombinedHeaderSurvivesQueryDecodingAndCookieParsing() {
        // URLSearchParams uses the same form encoding: spaces become '+'. In particular the
        // second cookie's name must not acquire the '+' that Android's plural accessor retains.
        val encoded = "nonce=${encode("expected-nonce")}&cookie=${encode(header)}"
        assertTrue(encoded.contains("%2C+__Secure-better-auth.session_token"))
        val query = decodeOAuthQuery(encoded)
        assertEquals(listOf("expected-nonce"), query["nonce"])
        assertEquals(listOf(header), query["cookie"])
        val cookies = parseCallbackCookies(base, query.getValue("cookie").single())
        val session = cookies.single { it.name == "__Secure-better-auth.session_token" }
        assertEquals("token%2Bsig%3D", session.value)
        assertEquals("api.example.com", session.domain)
        assertTrue(session.matches(base.resolve("/api/auth/get-session")!!))
        assertTrue(session.expiresAt > System.currentTimeMillis())
    }

    @Test fun queryDecodingPreservesLiteralPlusAndCookiePercentEscapesExactlyOnce() {
        val literal = "better-auth.session_token=literal+plus%2Bencoded%25percent; Path=/; HttpOnly"
        val query = decodeOAuthQuery("cookie=${encode(literal)}&nonce=${encode("nonce+%2B")}")
        assertEquals(literal, query.getValue("cookie").single())
        assertEquals("nonce+%2B", query.getValue("nonce").single())
        val session = parseCallbackCookies(base, query.getValue("cookie").single())
            .single { it.name == "better-auth.session_token" }
        assertEquals("literal+plus%2Bencoded%25percent", session.value)
    }

    @Test fun duplicateSecurityParametersRemainVisibleAfterDecodingParameterNames() {
        val query = decodeOAuthQuery("cookie=first&%63ookie=second&nonce=a&nonce=b")
        assertEquals(listOf("first", "second"), query["cookie"])
        assertEquals(listOf("a", "b"), query["nonce"])
        assertTrue(decodeOAuthQuery(null).isEmpty())
        assertTrue(decodeOAuthQuery("").isEmpty())
    }

    @Test fun malformedEncodingAndOversizedQueriesFailWithoutEchoingCookieSecrets() {
        val secret = "SENSITIVE_SESSION_FIXTURE"
        for (query in listOf("cookie=$secret%", "cookie=$secret%GG", "cookie=$secret%0", "coo%GGkie=$secret")) {
            val error = assertThrows(IllegalArgumentException::class.java) { decodeOAuthQuery(query) }
            assertFalse(error.message.orEmpty().contains(secret))
        }
        assertThrows(IllegalArgumentException::class.java) {
            decodeOAuthQuery("cookie=" + "a".repeat(256 * 1024 + 1))
        }
    }

    @Test fun cookiesOutsideTheConfiguredApiHostCannotAuthenticateTheApp() {
        for (domain in listOf("unrelated.example.net", ".example.com")) {
            assertThrows(IllegalArgumentException::class.java) {
                parseCallbackCookies(base, "__Secure-better-auth.session_token=fixture; Domain=$domain; Path=/; Secure; HttpOnly")
            }
        }
    }

    @Test fun missingEmptyExpiredAndWrongPathSessionCookiesAreRejected() {
        val invalid = listOf(
            "better-auth.oauth_state=state; Path=/; HttpOnly",
            "better-auth.session_token=; Path=/; HttpOnly",
            "better-auth.session_token=expired; Max-Age=0; Path=/; HttpOnly",
            "better-auth.session_token=expired; Expires=Sat, 01 Jan 2000 00:00:00 GMT; Path=/; HttpOnly",
            "better-auth.session_token=wrong-path; Path=/unrelated; HttpOnly",
        )
        invalid.forEach { value ->
            assertThrows(IllegalArgumentException::class.java) { parseCallbackCookies(base, value) }
        }
    }

    @Test fun secureSessionCookiesCannotBeImportedForAnHttpApi() {
        assertThrows(IllegalArgumentException::class.java) {
            parseCallbackCookies("http://localhost:4000".toHttpUrl(), "__Secure-better-auth.session_token=fixture; Path=/; Secure; HttpOnly")
        }
    }

    @Test fun validHostPrefixedBetterAuthSessionCookieIsRecognized() {
        val cookies = parseCallbackCookies(base, "__Host-better-auth.session_token=fixture; Max-Age=3600; Path=/; Secure; HttpOnly")
        assertEquals("__Host-better-auth.session_token", cookies.single().name)
        assertEquals("fixture", cookies.single().value)
    }

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")
}
