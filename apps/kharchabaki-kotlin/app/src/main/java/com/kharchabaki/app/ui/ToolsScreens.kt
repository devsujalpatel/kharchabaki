package com.kharchabaki.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.kharchabaki.app.data.*
import java.time.LocalDate
import java.time.YearMonth

sealed interface ToolAction {
    data class LoadMonth(val month: String) : ToolAction
    data class SaveBudget(val budget: Budget) : ToolAction
    data class DeleteBudget(val id: String) : ToolAction
    data class SaveLabel(val label: FinanceLabel) : ToolAction
    data class SaveRecurring(val rule: RecurringRule) : ToolAction
    data class DeleteRecurring(val id: String) : ToolAction
    data object RunRecurring : ToolAction
    data object ExportCsv : ToolAction
    data object ExportJson : ToolAction
    data object ImportCsv : ToolAction
    data object ImportJson : ToolAction
}

@Composable
fun ToolsScreen(route: String, state: FinanceState, busy: Boolean, onBack: () -> Unit, onAction: (ToolAction) -> Unit) {
    BackHandler(onBack = onBack)
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        TextButton(onClick = onBack) { Text("‹  Back to profile") }
        when (route) {
            "budgets" -> BudgetsScreen(state, busy, onAction)
            "recurring" -> RecurringScreen(state, busy, onAction)
            "categories" -> LabelsScreen(state, busy, onAction)
            else -> DataToolsScreen(state, busy, onAction)
        }
    }
}

private fun categoryOptions(state: FinanceState, type: String) =
    (if (type == "income") incomeSources else expenseCategories) + state.labels.filter { it.active && it.kind == type }.map { it.key }

@Composable
private fun BudgetsScreen(state: FinanceState, busy: Boolean, onAction: (ToolAction) -> Unit) {
    var month by remember { mutableStateOf(YearMonth.parse(currentMonth())) }
    var editor by remember { mutableStateOf<Budget?>(null) }
    var deleting by remember { mutableStateOf<Budget?>(null) }
    val money = rememberMoneyFormatter(state.preferences.currency)
    val budgets = remember(state.budgets, month) { state.budgets.filter { it.month == month.toString() } }
    LaunchedEffect(month, state.workspaceToken) {
        if (state.premium) onAction(ToolAction.LoadMonth(month.toString()))
    }
    PageHeading("Budgets", "Give each category a monthly limit.")
    MonthSelector(month, { month = it })
    Button(onClick = { editor = Budget(month = month.toString(), category = "food") }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("+  Set a budget") }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 16.dp)) {
        if (budgets.isEmpty()) item { EmptyState("Make room for your goals", "Set a category limit and follow your spending here.") }
        items(budgets, key = { it.id }) { budget ->
            val spent = remember(state.transactions, budget) { state.spentFor(budget) }
            val progress = (spent.toDouble() / budget.amountCents.coerceAtLeast(1)).toFloat()
            FinanceCard {
                Text(prettyLabel(budget.category), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("${money(spent)} of ${money(budget.amountCents)}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                LinearProgressIndicator(progress = { progress.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = if (progress * 100 >= budget.alertThreshold) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                Text(if (spent > budget.amountCents) "${money(spent - budget.amountCents)} over budget" else "${money(budget.amountCents - spent)} remaining", color = if (spent > budget.amountCents) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                Row {
                    TextButton(onClick = { editor = budget }, enabled = !busy) { Text("Edit") }
                    TextButton(onClick = { deleting = budget }, enabled = !busy) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
    editor?.let { value ->
        key(value.id) {
            var amount by remember { mutableStateOf(if (value.amountCents > 0) Money.decimal(value.amountCents) else "") }
            var category by remember { mutableStateOf(value.category) }
            var threshold by remember { mutableStateOf(value.alertThreshold.toString()) }
            EditorDialog("Budget for ${month.month.name.lowercase().replaceFirstChar(Char::titlecase)}", { editor = null }, valid = !busy && validCents(amount) != null && threshold.toIntOrNull() in 1..100, onConfirm = {
                onAction(ToolAction.SaveBudget(value.copy(amountCents = validCents(amount)!!, category = category, alertThreshold = threshold.toInt()))); editor = null
            }) {
                ChoiceField("Category", category, categoryOptions(state, "expense"), { category = it })
                AmountField(amount, { amount = it }, "Monthly limit")
                OutlinedTextField(threshold, { threshold = it }, label = { Text("Alert at % (1–100)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                Text("Limits track expenses dated within this UTC month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
    deleting?.let { value -> ConfirmDelete("Delete budget?", "Your transactions will stay in history.", { deleting = null }) { onAction(ToolAction.DeleteBudget(value.id)); deleting = null } }
}

@Composable
private fun RecurringScreen(state: FinanceState, busy: Boolean, onAction: (ToolAction) -> Unit) {
    var editor by remember { mutableStateOf<RecurringRule?>(null) }
    var deleting by remember { mutableStateOf<RecurringRule?>(null) }
    val money = rememberMoneyFormatter(state.preferences.currency)
    PageHeading("Recurring", "Keep regular income and expenses on track.")
    Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { editor = RecurringRule(category = "subscriptions") }, enabled = !busy, modifier = Modifier.weight(1f)) { Text("+  Add rule") }
        OutlinedButton(onClick = { onAction(ToolAction.RunRecurring) }, enabled = !busy) { Text("Run due") }
    }
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(if (state.premium) "Due cloud entries are processed when you sync." else "Due entries are generated when you open the app or tap Run due. No background alarm is required.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        if (state.recurring.isEmpty()) item { EmptyState("Your routine, remembered", "Add rent, subscriptions, salary, or another regular entry.") }
        items(state.recurring, key = { it.id }) { rule ->
            FinanceCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(rule.description.ifBlank { prettyLabel(rule.category) }, fontWeight = FontWeight.SemiBold)
                        Text("${prettyLabel(rule.type)} · ${money(rule.amountCents)}", color = MaterialTheme.colorScheme.primary)
                    }
                    Switch(checked = rule.enabled, onCheckedChange = { onAction(ToolAction.SaveRecurring(rule.copy(enabled = it))) }, enabled = !busy)
                }
                Text("Every ${rule.interval} ${rule.schedule} · Next ${rule.nextRunAt.take(10)}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row {
                    TextButton(onClick = { editor = rule }, enabled = !busy) { Text("Edit") }
                    TextButton(onClick = { deleting = rule }, enabled = !busy) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
    editor?.let { rule -> key(rule.id) {
        var type by remember { mutableStateOf(rule.type) }
        var amount by remember { mutableStateOf(if (rule.amountCents > 0) Money.decimal(rule.amountCents) else "") }
        var category by remember { mutableStateOf(rule.category) }
        var description by remember { mutableStateOf(rule.description) }
        var schedule by remember { mutableStateOf(rule.schedule) }
        var interval by remember { mutableStateOf(rule.interval.toString()) }
        var start by remember { mutableStateOf(dateOnly(rule.startAt)) }
        var hasEnd by remember { mutableStateOf(rule.endAt != null) }
        var end by remember { mutableStateOf(rule.endAt?.let(::dateOnly) ?: start.plusYears(1)) }
        EditorDialog("Recurring entry", { editor = null }, valid = !busy && validCents(amount) != null && interval.toIntOrNull() in 1..365 && (!hasEnd || !end.isBefore(start)) && description.length <= 1000, onConfirm = {
            val startIso = dateIso(start)
            onAction(ToolAction.SaveRecurring(rule.copy(type = type, amountCents = validCents(amount)!!, category = category, description = description, schedule = schedule, interval = interval.toInt(), startAt = startIso, nextRunAt = if (dateOnly(rule.startAt) != start) startIso else rule.nextRunAt, endAt = if (hasEnd) dateIso(end) else null))); editor = null
        }) {
            ChoiceField("Type", type, listOf("expense", "income"), { type = it; category = if (it == "income") "salary" else "subscriptions" })
            AmountField(amount, { amount = it })
            ChoiceField(if (type == "income") "Source" else "Category", category, categoryOptions(state, type), { category = it })
            OutlinedTextField(description, { description = it }, label = { Text("Description (optional)") }, modifier = Modifier.fillMaxWidth())
            ChoiceField("Schedule", schedule, listOf("daily", "weekly", "monthly", "yearly"), { schedule = it })
            OutlinedTextField(interval, { interval = it }, label = { Text("Every (1–365 intervals)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
            if (state.premium && state.recurring.any { it.id == rule.id }) {
                Text("Starts ${start}. Create a replacement rule to change its starting date.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else DateField(start, { start = it }, "Starts")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("End date"); Switch(hasEnd, { hasEnd = it }) }
            if (hasEnd) DateField(end, { end = it }, "Ends")
        }
    } }
    deleting?.let { value -> ConfirmDelete("Delete recurring rule?", "Entries already generated will stay in history.", { deleting = null }) { onAction(ToolAction.DeleteRecurring(value.id)); deleting = null } }
}

@Composable
private fun LabelsScreen(state: FinanceState, busy: Boolean, onAction: (ToolAction) -> Unit) {
    var editor by remember { mutableStateOf<FinanceLabel?>(null) }
    PageHeading("Categories & sources", "Make your money categories your own.")
    Button(onClick = { editor = FinanceLabel() }, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)) { Text("+  Add custom category") }
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Built-in categories stay available. Disabled custom categories remain visible on existing entries.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (state.labels.isEmpty()) item { EmptyState("A place for everything", "Add custom expense categories and income sources.") }
        items(state.labels, key = { it.id }) { label ->
            FinanceCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(label.name, fontWeight = FontWeight.SemiBold)
                        Text("${prettyLabel(label.kind)} · ${label.key}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(label.active, { onAction(ToolAction.SaveLabel(label.copy(active = it))) }, enabled = !busy)
                }
                TextButton(onClick = { editor = label }, enabled = !busy) { Text("Rename") }
            }
        }
    }
    editor?.let { label -> key(label.id) {
        val existing = state.labels.any { it.id == label.id }
        var name by remember { mutableStateOf(label.name) }
        var type by remember { mutableStateOf(label.kind) }
        var key by remember { mutableStateOf(label.key) }
        val valid = name.trim().length in 1..60 && Regex("[a-zA-Z0-9 _-]{1,100}").matches(key.trim())
        EditorDialog(if (existing) "Rename category" else "New category", { editor = null }, valid = !busy && valid, onConfirm = {
            onAction(ToolAction.SaveLabel(label.copy(kind = type, name = name.trim(), key = key.trim()))); editor = null
        }) {
            if (!existing) ChoiceField("Type", type, listOf("expense", "income"), { type = it })
            OutlinedTextField(name, { name = it; if (!existing) key = it.trim().lowercase().replace(Regex("[^a-z0-9 _-]"), "").replace(' ', '-') }, label = { Text("Display name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            if (!existing) OutlinedTextField(key, { key = it }, label = { Text("Key (letters, numbers, spaces, _ or -)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
    } }
}

@Composable
private fun DataToolsScreen(state: FinanceState, busy: Boolean, onAction: (ToolAction) -> Unit) {
    var confirmingRestore by remember { mutableStateOf(false) }
    PageHeading("Data tools", "Keep a copy of the records that matter.")
    LazyColumn(contentPadding = PaddingValues(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { FinanceCard {
            Text("Transaction CSV", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Export your full history, or add entries from a CSV with type, amount, category, source, description, and occurredAt columns. Repeat imports skip matching rows.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = { onAction(ToolAction.ExportCsv) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Export CSV") }
            OutlinedButton(onClick = { onAction(ToolAction.ImportCsv) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Import CSV") }
        } }
        item { FinanceCard {
            Text("Workspace backup", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Save transactions, balance, loans, budgets, recurring rules, categories, and preferences as JSON. Keep the backup somewhere private.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = { onAction(ToolAction.ExportJson) }, enabled = !busy && !state.premium, modifier = Modifier.fillMaxWidth()) { Text("Export JSON backup") }
            OutlinedButton(onClick = { confirmingRestore = true }, enabled = !busy && !state.premium, modifier = Modifier.fillMaxWidth()) { Text("Restore JSON backup") }
        } }
        if (state.premium) item { Text("Imported transactions join your Premium sync queue. Full backup export and restore are available in device workspaces.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Text("Backups and transaction CSV files work with the existing React Native app. App storage is separate: export there and import here to transfer your records.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }
    if (confirmingRestore) AlertDialog(onDismissRequest = { confirmingRestore = false }, title = { Text("Replace this workspace?") }, text = { Text("Restoring replaces the current device workspace with the selected backup. Export a backup first if you want to keep the current records.") }, confirmButton = { TextButton(onClick = { confirmingRestore = false; onAction(ToolAction.ImportJson) }) { Text("Choose backup") } }, dismissButton = { TextButton(onClick = { confirmingRestore = false }) { Text("Cancel") } })
}

@Composable
private fun ConfirmDelete(title: String, message: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, title = { Text(title) }, text = { Text(message) }, confirmButton = { TextButton(onClick = onConfirm) { Text("Delete", color = MaterialTheme.colorScheme.error) } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}
