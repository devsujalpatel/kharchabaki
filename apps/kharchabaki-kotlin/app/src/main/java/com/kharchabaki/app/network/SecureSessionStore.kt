package com.kharchabaki.app.network

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Auth secrets stay in the app's non-backup directory, encrypted with a non-exportable key. */
internal class SecureSessionStore(context: Context) {
    private val directory by lazy { File(context.noBackupFilesDir, "auth") }
    private val key: SecretKey by lazy {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey) ?: KeyGenerator
            .getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
                init(KeyGenParameterSpec.Builder(KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true).build())
            }.generateKey()
    }

    @Synchronized fun read(name: String): String? {
        val file = AtomicFile(File(directory, name))
        if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) return null
        return try {
            val bytes = file.readFully()
            require(bytes.size > 13 && bytes[0].toInt() == 1)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
            cipher.updateAAD(name.toByteArray())
            cipher.doFinal(bytes.copyOfRange(13, bytes.size)).toString(Charsets.UTF_8)
        } catch (error: Exception) {
            // A restored ciphertext without its original hardware key cannot authenticate.
            file.delete()
            null
        }
    }

    @Synchronized fun write(name: String, value: String?) {
        directory.mkdirs()
        val file = AtomicFile(File(directory, name))
        if (value == null) { file.delete(); return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        cipher.updateAAD(name.toByteArray())
        val bytes = byteArrayOf(1) + cipher.iv + cipher.doFinal(value.toByteArray())
        val stream = file.startWrite()
        try { stream.write(bytes); file.finishWrite(stream) }
        catch (error: Exception) { file.failWrite(stream); throw error }
    }

    private companion object { const val KEY_ALIAS = "kharchabaki.kotlin.auth.v1" }
}
