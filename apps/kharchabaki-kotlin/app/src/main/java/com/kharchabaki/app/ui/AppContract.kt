package com.kharchabaki.app.ui

import com.kharchabaki.app.data.FinanceState
import com.kharchabaki.app.data.FinanceTransaction
import com.kharchabaki.app.data.Loan
import com.kharchabaki.app.data.Preferences

data class AppUiState(
    val finance: FinanceState = FinanceState(),
    val authenticated: Boolean = false,
    val localOnly: Boolean = false,
    val displayName: String = "",
    val email: String = "",
    val loading: Boolean = false,
    val syncStatus: String = "Saved on this device",
    val message: String? = null,
    val error: String? = null,
)

sealed interface AppAction {
    data object StartOffline : AppAction
    data object SignIn : AppAction
    data class EmailSignIn(val email: String, val password: String) : AppAction
    data object SignOut : AppAction
    data object Sync : AppAction
    data object DiscardPending : AppAction
    data object DismissMessage : AppAction
    data class SaveTransaction(val transaction: FinanceTransaction) : AppAction
    data class DeleteTransaction(val id: String) : AppAction
    data class SaveLoan(val loan: Loan) : AppAction
    data class DeleteLoan(val id: String) : AppAction
    data class RecordPayment(val id: String, val amountCents: Long) : AppAction
    data class SavePreferences(val preferences: Preferences) : AppAction
    data class SetOpeningBalance(val cents: Long) : AppAction
}
