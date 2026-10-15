package com.kharchabaki.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kharchabaki.app.data.FinanceLabel
import com.kharchabaki.app.data.FinanceTransaction
import com.kharchabaki.app.data.Money
import com.kharchabaki.app.data.expenseCategories
import com.kharchabaki.app.data.incomeSources
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private data class MonthTotals(val balance: Long, val income: Long, val expense: Long)

@Composable
fun OverviewScreen(state: AppUiState, onAction: (AppAction) -> Unit, onHistory: () -> Unit) {
    var monthString by rememberSaveable { mutableStateOf(YearMonth.now(ZoneOffset.UTC).toString()) }
    val month = YearMonth.parse(monthString)
    var draft by remember { mutableStateOf<FinanceTransaction?>(null) }
    val money = rememberMoneyFormatter(state.finance.preferences.currency)
    val totals = remember(state.finance.transactions, state.finance.openingBalanceCents, state.finance.loans, month) {
        var income = 0L; var expense = 0L
        state.finance.transactions.forEach { t ->
            if (t.occurredAt.startsWith(month.toString())) { if (t.type == "income") income += t.amountCents else expense += t.amountCents }
        }
        MonthTotals(state.finance.balanceCents, income, expense)
    }
    val recent = remember(state.finance.transactions, month) { state.finance.transactions.filter { it.occurredAt.startsWith(month.toString()) }.sortedByDescending { it.occurredAt }.take(5) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(if (state.localOnly) "SAVED ON THIS DEVICE" else "HELLO, ${state.displayName.substringBefore(' ').ifBlank { "THERE" }.uppercase()}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, letterSpacing = 1.5.sp)
                PageHeading("Your money")
                MonthSelector(month) { monthString = it.toString() }
            }
        }
        item {
            Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.primaryContainer, border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .25f))) {
                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Available balance", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                        Text("₹", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    }
                    Text(money(totals.balance), fontSize = 36.sp, lineHeight = 44.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1.5).sp, maxLines = 2)
                    Text("Across all your activity", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TotalCard("Income", money(totals.income), true, Modifier.weight(1f))
                TotalCard("Expenses", money(totals.expense), false, Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Monthly net", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text((if (totals.income >= totals.expense) "+" else "−") + money(kotlin.math.abs(totals.income - totals.expense)), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = if (totals.income >= totals.expense) incomeColor else expenseColor)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { draft = FinanceTransaction(type = "expense", category = "food") }, modifier = Modifier.weight(1f).heightIn(min = 56.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, expenseColor.copy(alpha = .4f))) { Text("↗  Expense", color = MaterialTheme.colorScheme.onSurface, maxLines = 1) }
                Button(onClick = { draft = FinanceTransaction(type = "income", category = "salary") }, modifier = Modifier.weight(1f).heightIn(min = 56.dp), shape = RoundedCornerShape(16.dp)) { Text("↙  Income", maxLines = 1) }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Recent activity", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = onHistory) { Text("View all  ›") }
            }
        }
        if (recent.isEmpty()) item { EmptyState("A fresh start", "Add your first income or expense to start seeing your money clearly.") }
        items(recent, key = { it.id }) { transaction -> TransactionRow(transaction, money, onEdit = { draft = transaction }) }
        item { Text(state.syncStatus, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp, bottom = 16.dp)) }
    }
    draft?.let { entry -> TransactionEditor(entry, state.finance.labels, state.finance.preferences.currency, state.finance.balanceCents, state.finance.transactions.firstOrNull { it.id == entry.id }, onDismiss = { draft = null }, onSave = { onAction(AppAction.SaveTransaction(it)); draft = null }) }
}

@Composable
private fun TotalCard(label: String, amount: String, income: Boolean, modifier: Modifier = Modifier) {
    FinanceCard(modifier) {
        Text((if (income) "↙  " else "↗  ") + label, color = if (income) incomeColor else expenseColor, style = MaterialTheme.typography.bodySmall)
        Text(amount, fontSize = 21.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.5).sp, maxLines = 2)
    }
}

@Composable
fun HistoryScreen(state: AppUiState, onAction: (AppAction) -> Unit) {
    var monthString by rememberSaveable { mutableStateOf(YearMonth.now(ZoneOffset.UTC).toString()) }
    val month = YearMonth.parse(monthString)
    var allMonths by rememberSaveable { mutableStateOf(false) }
    var type by rememberSaveable { mutableStateOf("all") }
    var category by rememberSaveable { mutableStateOf("all") }
    var search by rememberSaveable { mutableStateOf("") }
    var draft by remember { mutableStateOf<FinanceTransaction?>(null) }
    var deleting by remember { mutableStateOf<FinanceTransaction?>(null) }
    val money = rememberMoneyFormatter(state.finance.preferences.currency)
    val options = remember(type, state.finance.labels) {
        (listOf("all") + (if (type == "all") incomeSources + expenseCategories else if (type == "income") incomeSources else expenseCategories) + state.finance.labels.filter { it.active && (type == "all" || it.kind == type) }.map { it.key }).distinct()
    }
    val filtered = remember(state.finance.transactions, monthString, allMonths, type, category, search) {
        val query = search.trim()
        state.finance.transactions.filter { t ->
            (allMonths || t.occurredAt.startsWith(monthString)) && (type == "all" || t.type == type) && (category == "all" || t.category == category) &&
                (query.isBlank() || t.description.contains(query, true) || prettyLabel(t.category).contains(query, true) || Money.decimal(t.amountCents).contains(query))
        }.sortedByDescending { it.occurredAt }
    }
    val groups = remember(filtered) { filtered.groupBy { it.occurredAt.take(10) } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PageHeading("Transactions", "${filtered.size} ${if (filtered.size == 1) "entry" else "entries"}") { FilledTonalButton(onClick = { draft = FinanceTransaction(category = "food") }, shape = RoundedCornerShape(14.dp)) { Text("+ Add") } }
                if (!allMonths) MonthSelector(month) { monthString = it.toString() }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(allMonths, { allMonths = it }); Text("All time", style = MaterialTheme.typography.bodyMedium) }
                OutlinedTextField(search, { search = it }, label = { Text("Search transactions") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(16.dp), trailingIcon = { if (search.isNotBlank()) TextButton(onClick = { search = "" }) { Text("✕") } })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all", "income", "expense").forEach { value -> FilterChip(selected = type == value, onClick = { type = value; category = "all" }, label = { Text(prettyLabel(value)) }) }
                }
                ChoiceField("Category", category, options, { category = it }, display = { if (it == "all") "All categories" else prettyLabel(it) })
                if (search.isNotBlank() || type != "all" || category != "all") TextButton(onClick = { search = ""; type = "all"; category = "all" }) { Text("Clear filters") }
            }
        }
        if (filtered.isEmpty()) item { EmptyState("No transactions here", "Try another month or filter, or add a new transaction.") }
        groups.forEach { (day, entries) ->
            item(key = "date-$day") { Text(dateOnly(day).format(DateTimeFormatter.ofPattern("EEE, dd MMM yyyy")), Modifier.padding(top = 10.dp, bottom = 2.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(entries, key = { it.id }, contentType = { "transaction" }) { transaction -> TransactionRow(transaction, money, onEdit = { draft = transaction }, onDelete = { deleting = transaction }) }
        }
        item { Spacer(Modifier.height(8.dp)) }
    }
    draft?.let { entry -> TransactionEditor(entry, state.finance.labels, state.finance.preferences.currency, state.finance.balanceCents, state.finance.transactions.firstOrNull { it.id == entry.id }, { draft = null }) { saved -> onAction(AppAction.SaveTransaction(saved)); draft = null } }
    deleting?.let { transaction ->
        val canDelete = projectedBalance(state.finance.balanceCents, transaction.signedCents, 0)?.let { it >= 0 } == true
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Delete ${transaction.type}?") }, text = { Text(if (canDelete) "${money(transaction.amountCents)} will be removed and your balance updated." else "Deleting this income would leave a negative balance. Update your balance or other transactions first.") },
            confirmButton = { TextButton(enabled = canDelete, onClick = { onAction(AppAction.DeleteTransaction(transaction.id)); deleting = null }) { Text("Delete", color = if (canDelete) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } })
    }
}

@Composable
private fun TransactionRow(transaction: FinanceTransaction, money: (Long) -> String, onEdit: () -> Unit, onDelete: (() -> Unit)? = null) {
    var menu by remember { mutableStateOf(false) }
    Surface(onClick = onEdit, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Row(Modifier.padding(start = 14.dp, top = 15.dp, bottom = 15.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(shape = RoundedCornerShape(14.dp), color = (if (transaction.type == "income") incomeColor else expenseColor).copy(alpha = .12f)) {
                Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) { Text(if (transaction.type == "income") "↙" else "↗", fontSize = 24.sp, color = if (transaction.type == "income") incomeColor else expenseColor) }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(prettyLabel(transaction.category), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(transaction.description.ifBlank { dateOnly(transaction.occurredAt).format(DateTimeFormatter.ofPattern("dd MMM")) }, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (transaction.pending) Text("Waiting to sync", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
            Text((if (transaction.type == "income") "+" else "−") + money(transaction.amountCents), fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium, color = if (transaction.type == "income") incomeColor else MaterialTheme.colorScheme.onSurface, maxLines = 2, modifier = Modifier.widthIn(max = 140.dp))
            if (onDelete != null) Box {
                TextButton(onClick = { menu = true }, contentPadding = PaddingValues(0.dp), modifier = Modifier.width(36.dp)) { Text("⋮", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 24.sp) }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem(text = { Text("Edit") }, onClick = { menu = false; onEdit() })
                    DropdownMenuItem(text = { Text("Delete", color = MaterialTheme.colorScheme.error) }, onClick = { menu = false; onDelete() })
                }
            }
        }
    }
}

@Composable
private fun TransactionEditor(transaction: FinanceTransaction, labels: List<FinanceLabel>, currency: String, balance: Long, previous: FinanceTransaction?, onDismiss: () -> Unit, onSave: (FinanceTransaction) -> Unit) {
    var amount by remember(transaction.id) { mutableStateOf(if (transaction.amountCents > 0) Money.decimal(transaction.amountCents) else "") }
    var type by remember(transaction.id) { mutableStateOf(transaction.type) }
    var category by remember(transaction.id) { mutableStateOf(transaction.category) }
    var note by remember(transaction.id) { mutableStateOf(transaction.description) }
    var date by remember(transaction.id) { mutableStateOf(dateOnly(transaction.occurredAt)) }
    val options = remember(type, labels, transaction.category) { ((if (type == "income") incomeSources else expenseCategories) + labels.filter { it.active && it.kind == type }.map { it.key } + if (transaction.type == type) listOf(transaction.category) else emptyList()).distinct() }
    val cents = validCents(amount)
    val projected = cents?.let { projectedBalance(balance, previous?.signedCents ?: 0, if (type == "income") it else -it) }
    val sufficientBalance = projected != null && projected >= 0
    EditorDialog(if (transaction.amountCents == 0L) "Add $type" else "Edit $type", onDismiss, valid = cents != null && category in options && note.length <= 1000 && sufficientBalance, onConfirm = {
        val validAmount = validCents(amount) ?: return@EditorDialog
        if (!sufficientBalance) return@EditorDialog
        onSave(transaction.copy(type = type, amountCents = validAmount, category = category, description = note.trim(), occurredAt = if (date == dateOnly(transaction.occurredAt)) transaction.occurredAt else dateIso(date)))
    }) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("expense", "income").forEach { choice -> FilterChip(type == choice, onClick = { type = choice; category = if (choice == "income") "salary" else "food" }, label = { Text(prettyLabel(choice)) }) }
        }
        AmountField(amount, { amount = it }, prefix = currency)
        ChoiceField(if (type == "income") "Source" else "Category", category, options, { category = it })
        DateField(date, { date = it })
        OutlinedTextField(note, { if (it.length <= 1000) note = it }, label = { Text("Note (optional)") }, modifier = Modifier.fillMaxWidth(), minLines = 3, maxLines = 5, shape = RoundedCornerShape(16.dp))
        if (amount.isNotBlank() && cents == null) Text("Enter an amount greater than zero with up to two decimal places.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (cents != null && !sufficientBalance) Text("This change would leave a negative balance. Add income or update your available balance first.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}
