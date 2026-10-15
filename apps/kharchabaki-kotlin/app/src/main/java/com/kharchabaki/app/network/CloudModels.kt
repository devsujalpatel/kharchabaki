package com.kharchabaki.app.network

import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class SessionIdentity(
    val userId: String,
    val name: String,
    val email: String,
    val image: String? = null,
    val isPremium: Boolean = false,
    val sessionId: String,
    val expiresAt: String,
    val localOnly: Boolean = false,
) {
    val valid: Boolean get() = localOnly || runCatching { Instant.parse(expiresAt).isAfter(Instant.now()) }.getOrDefault(false)
}

data class CloudState(
    val session: SessionIdentity? = null,
    val starting: Boolean = true,
    val verifying: Boolean = false,
    val syncing: Boolean = false,
    val online: Boolean = true,
    val error: String? = null,
    val reason: String? = null,
)

class ApiException(val status: Int, override val message: String) : Exception(message)

@Serializable
internal data class PendingOAuth(val nonce: String, val createdAt: Long)
