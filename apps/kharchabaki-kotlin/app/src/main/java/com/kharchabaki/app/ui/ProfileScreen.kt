package com.kharchabaki.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kharchabaki.app.data.Money
import com.kharchabaki.app.data.popularCurrencies
import java.util.Currency
import java.util.Locale

@Composable
fun ProfileScreen(state: AppUiState, onAction: (AppAction) -> Unit, onNavigateTool: (String) -> Unit) {
    val preferences = state.finance.preferences
    val money = rememberMoneyFormatter(preferences.currency)
    var balanceDialog by remember { mutableStateOf(false) }
    var signOutDialog by remember { mutableStateOf(false) }
    var discardDialog by remember { mutableStateOf(false) }
    val currencies = remember { popularCurrencies + Currency.getAvailableCurrencies().map { it.currencyCode }.sorted().filterNot { it in popularCurrencies || it == "XXX" } }
    val canSetBalance = !state.finance.premium || state.finance.outbox.isEmpty()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { PageHeading("Profile", "Make your money feel like you.") }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(18.dp)) {
                        Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) { Text(if (state.localOnly) "₹" else state.displayName.split(' ').filter { it.isNotBlank() }.take(2).map { it.first().uppercaseChar() }.joinToString("").ifBlank { "K" }, fontSize = 22.sp, fontWeight = FontWeight.SemiBold) }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(if (state.localOnly) "Offline workspace" else state.displayName.ifBlank { "Your account" }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(if (state.localOnly) "On this device" else state.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (state.localOnly) TextButton(onClick = { onAction(AppAction.SignIn) }, enabled = !state.loading) { Text("Connect your Google account  ›") }
                else TextButton(onClick = { signOutDialog = true }) { Text("Sign out", color = MaterialTheme.colorScheme.error) }
            }
        }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(8.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(4.dp)))
                    Spacer(Modifier.width(9.dp))
                    Text(if (state.finance.premium && !state.localOnly) "Premium cloud sync" else "Device storage", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
                Text(state.syncStatus, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                if (state.finance.outbox.isNotEmpty()) Text("${state.finance.outbox.size} changes waiting to sync", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                if (state.finance.premium && state.finance.outbox.isNotEmpty()) {
                    state.finance.outbox.firstNotNullOfOrNull { it.error }?.let { error ->
                        Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                    }
                    TextButton(onClick = { discardDialog = true }, enabled = !state.loading) { Text("Discard pending changes", color = MaterialTheme.colorScheme.error) }
                }
                if (state.finance.premium && !state.localOnly) OutlinedButton(onClick = { onAction(AppAction.Sync) }, enabled = !state.loading, shape = RoundedCornerShape(12.dp)) { Text("Sync now") }
            }
        }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Available balance", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = { balanceDialog = true }, enabled = canSetBalance) { Text("Set balance") }
                }
                Text(money(state.finance.balanceCents), fontSize = 30.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.8).sp)
                if (!canSetBalance) Text("Finish syncing before changing the balance.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Text("Finance tools", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                listOf("Budgets" to "budgets", "Recurring entries" to "recurring", "Categories & sources" to "categories", "Import & export" to "data-tools").forEachIndexed { index, (name, route) ->
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Row(Modifier.fillMaxWidth().clickable { onNavigateTool(route) }.padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(listOf("◴", "↻", "#", "⇅")[index], color = MaterialTheme.colorScheme.primary, fontSize = 23.sp, modifier = Modifier.width(34.dp))
                        Text(name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Text("›", fontSize = 25.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Text("Currency", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                ChoiceField("Display currency", preferences.currency, currencies, { onAction(AppAction.SavePreferences(preferences.copy(currency = it))) }, display = { code -> "$code · ${runCatching { Currency.getInstance(code).getDisplayName(Locale.ENGLISH) }.getOrDefault(code)}" })
                Text("Changes display formatting. Existing amounts are not converted.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Text("Appearance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                appPalettes.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { palette ->
                            val selected = preferences.theme == palette.key
                            Surface(onClick = { onAction(AppAction.SavePreferences(preferences.copy(theme = palette.key))) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp), color = palette.background,
                                border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Box(Modifier.size(20.dp).background(palette.primary, RoundedCornerShape(7.dp)))
                                        Text(if (selected) "✓" else "", color = palette.primary, fontSize = 18.sp)
                                    }
                                    Text(prettyLabel(palette.key), color = palette.foreground, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
        item { Text("KHARCHABAKI · BUILT FOR CLARITY", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, letterSpacing = 1.sp, modifier = Modifier.padding(vertical = 18.dp)) }
    }
    if (balanceDialog) {
        var amount by remember { mutableStateOf(Money.decimal(state.finance.balanceCents)) }
        val cents = validCents(amount, allowZero = true)
        EditorDialog("Set available balance", { balanceDialog = false }, "Save balance", valid = cents != null && canSetBalance, onConfirm = {
            validCents(amount, allowZero = true)?.let { onAction(AppAction.SetOpeningBalance(it)); balanceDialog = false }
        }) {
            Text("Enter the money you currently have. This replaces your available balance while keeping your transaction history.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            AmountField(amount, { amount = it }, prefix = preferences.currency)
        }
    }
    if (signOutDialog) AlertDialog(onDismissRequest = { signOutDialog = false }, title = { Text("Sign out?") }, text = { Text("Your workspace and any unsynced changes will stay saved on this device.") },
        confirmButton = { TextButton(onClick = { signOutDialog = false; onAction(AppAction.SignOut) }) { Text("Sign out", color = MaterialTheme.colorScheme.error) } }, dismissButton = { TextButton(onClick = { signOutDialog = false }) { Text("Cancel") } })
    if (discardDialog) AlertDialog(onDismissRequest = { discardDialog = false }, title = { Text("Discard pending changes?") },
        text = { Text("All unsynced local cloud changes will be discarded and your server data reloaded. Changes already accepted by the server will be kept. An internet connection is required.") },
        confirmButton = { TextButton(enabled = !state.loading, onClick = { discardDialog = false; onAction(AppAction.DiscardPending) }) { Text("Discard changes", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { discardDialog = false }) { Text("Cancel") } })
}
