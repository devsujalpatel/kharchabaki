package com.kharchabaki.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kharchabaki.app.data.Loan
import com.kharchabaki.app.data.Money
import java.math.BigDecimal
import java.time.format.DateTimeFormatter

private fun loanBalanceEffect(loan: Loan): Long = (loan.amountCents - loan.paidCents) * if (loan.kind == "taken") 1 else -1

internal const val loanMessageBody = "Hi, this is a reminder about the amount we discussed. Please let me know when you can repay it."
internal fun canMessageLoan(loan: Loan): Boolean = loan.kind == "given" && loan.phoneNumber.isNotBlank()

@Composable
fun LoansScreen(state: AppUiState, onAction: (AppAction) -> Unit) {
    var kind by rememberSaveable { mutableStateOf("taken") }
    var status by rememberSaveable { mutableStateOf("all") }
    var draft by remember { mutableStateOf<Loan?>(null) }
    var deleting by remember { mutableStateOf<Loan?>(null) }
    var paying by remember { mutableStateOf<Loan?>(null) }
    val money = rememberMoneyFormatter(state.finance.preferences.currency)
    val loans = remember(state.finance.loans, kind, status) { state.finance.loans.filter { it.kind == kind && (status == "all" || if (status == "open") it.remainingCents > 0 else it.remainingCents == 0L) }.sortedBy { it.dueDate } }
    val remaining = remember(state.finance.loans, kind) { state.finance.loans.filter { it.kind == kind }.sumOf { it.remainingCents } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { PageHeading("Loans", "Keep track of what you owe and what comes back.") { FilledTonalButton(onClick = { draft = Loan(kind = kind) }, shape = RoundedCornerShape(14.dp)) { Text("+ Add") } } }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilterChip(kind == "taken", { kind = "taken" }, label = { Text("Borrowed") })
                FilterChip(kind == "given", { kind = "given" }, label = { Text("Lent") })
            }
        }
        item {
            Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.primaryContainer, border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .2f))) {
                Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(if (kind == "taken") "Left to repay" else "Left to collect", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    Text(money(remaining), fontSize = 34.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1).sp)
                    Text("Including flat interest", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("all", "open", "paid").forEach { choice -> FilterChip(status == choice, { status = choice }, label = { Text(prettyLabel(choice)) }) } }
        }
        if (loans.isEmpty()) item { EmptyState(if (kind == "taken") "No borrowed loans" else "No lent loans", "Add a loan to keep amounts, due dates, and repayments together.") }
        items(loans, key = { it.id }, contentType = { "loan" }) { loan ->
            LoanCard(loan, money, onEdit = { draft = loan }, onDelete = { deleting = loan }, onRepay = { paying = loan }, onMessage = { onAction(AppAction.MessageLoan(loan.phoneNumber)) })
        }
        item { Spacer(Modifier.height(12.dp)) }
    }
    draft?.let { entry -> LoanEditor(entry, state.finance.preferences.currency, state.finance.balanceCents, state.finance.loans.firstOrNull { it.id == entry.id }, onDismiss = { draft = null }) { value -> onAction(AppAction.SaveLoan(value)); draft = null } }
    paying?.let { initial ->
        val loan = state.finance.loans.firstOrNull { it.id == initial.id } ?: initial
        var amount by remember(loan.id) { mutableStateOf("") }
        val cents = validCents(amount)
        val projected = cents?.let { projectedBalance(state.finance.balanceCents, 0, if (loan.kind == "taken") -it else it) }
        val sufficientBalance = projected != null && projected >= 0
        EditorDialog(if (loan.kind == "taken") "Record repayment" else "Record collection", { paying = null }, "Save payment", valid = cents != null && cents <= loan.remainingCents && sufficientBalance, onConfirm = {
            val payment = validCents(amount) ?: return@EditorDialog
            if (payment <= loan.remainingCents && sufficientBalance) { onAction(AppAction.RecordPayment(loan.id, payment)); paying = null }
        }) {
            Text("${loan.person} · ${money(loan.remainingCents)} remaining", color = MaterialTheme.colorScheme.onSurfaceVariant)
            AmountField(amount, { amount = it }, prefix = state.finance.preferences.currency)
            TextButton(onClick = { amount = Money.decimal(loan.remainingCents) }) { Text("Pay full remaining amount") }
            if (cents != null && cents > loan.remainingCents) Text("The payment cannot exceed the remaining amount.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            if (cents != null && !sufficientBalance) Text("There is not enough available balance for this repayment.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
    deleting?.let { loan ->
        val canDelete = projectedBalance(state.finance.balanceCents, loanBalanceEffect(loan), 0)?.let { it >= 0 } == true
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Delete loan?") }, text = { Text(if (canDelete) "The loan from ${loan.person} and its payment history will be removed. Your balance will be updated." else "Deleting this loan would leave a negative balance. Update your balance or transactions first.") },
            confirmButton = { TextButton(enabled = canDelete, onClick = { onAction(AppAction.DeleteLoan(loan.id)); deleting = null }) { Text("Delete", color = if (canDelete) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } })
    }
}

@Composable
private fun LoanCard(loan: Loan, money: (Long) -> String, onEdit: () -> Unit, onDelete: () -> Unit, onRepay: () -> Unit, onMessage: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    var history by rememberSaveable(loan.id) { mutableStateOf(false) }
    FinanceCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(loan.person, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleMedium)
                Text("Due ${dateOnly(loan.dueDate).format(DateTimeFormatter.ofPattern("dd MMM yyyy"))}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            Surface(shape = RoundedCornerShape(8.dp), color = (if (loan.status == "overdue") expenseColor else if (loan.status == "paid") incomeColor else MaterialTheme.colorScheme.primary).copy(alpha = .12f)) {
                Text(prettyLabel(loan.status), Modifier.padding(horizontal = 9.dp, vertical = 5.dp), style = MaterialTheme.typography.labelSmall, color = if (loan.status == "overdue") expenseColor else if (loan.status == "paid") incomeColor else MaterialTheme.colorScheme.primary)
            }
            Box {
                TextButton(onClick = { menu = true }, modifier = Modifier.width(32.dp), contentPadding = PaddingValues(0.dp)) { Text("⋮", fontSize = 24.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem(text = { Text("Edit loan") }, onClick = { menu = false; onEdit() })
                    DropdownMenuItem(text = { Text("Delete loan", color = MaterialTheme.colorScheme.error) }, onClick = { menu = false; onDelete() })
                }
            }
        }
        Text(money(loan.remainingCents), fontSize = 28.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.7).sp)
        Text("${money(loan.paidCents)} paid of ${money(loan.totalCents)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        LinearProgressIndicator(progress = { if (loan.totalCents > 0) (loan.paidCents.toDouble()/loan.totalCents).toFloat().coerceIn(0f,1f) else 0f }, modifier = Modifier.fillMaxWidth().height(5.dp), trackColor = MaterialTheme.colorScheme.surfaceVariant)
        Text("Principal ${money(loan.amountCents)} · ${BigDecimal.valueOf(loan.interestBasisPoints.toLong(),2).stripTrailingZeros().toPlainString()}% interest", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (loan.phoneNumber.isNotBlank()) Text(loan.phoneNumber, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (loan.payments.isNotEmpty()) TextButton(onClick = { history = !history }) { Text(if (history) "Hide payments" else "${loan.payments.size} payments", style = MaterialTheme.typography.labelMedium) }
            Spacer(Modifier.weight(1f))
            if (canMessageLoan(loan)) TextButton(onClick = onMessage, modifier = Modifier.heightIn(min = 48.dp)) { Text("Message") }
            if (loan.remainingCents > 0) FilledTonalButton(onClick = onRepay, shape = RoundedCornerShape(12.dp)) { Text(if (loan.kind == "taken") "Repay" else "Collect") }
        }
        if (history) loan.payments.sortedByDescending { it.paidAt }.forEach { payment ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(dateOnly(payment.paidAt).format(DateTimeFormatter.ofPattern("dd MMM yyyy")), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(money(payment.amountCents), style = MaterialTheme.typography.bodySmall, color = incomeColor)
            }
        }
    }
}

@Composable
private fun LoanEditor(loan: Loan, currency: String, balance: Long, previous: Loan?, onDismiss: () -> Unit, onSave: (Loan) -> Unit) {
    var kind by remember(loan.id) { mutableStateOf(loan.kind) }
    var person by remember(loan.id) { mutableStateOf(loan.person) }
    var phone by remember(loan.id) { mutableStateOf(loan.phoneNumber) }
    var amount by remember(loan.id) { mutableStateOf(if (loan.amountCents > 0) Money.decimal(loan.amountCents) else "") }
    var interest by remember(loan.id) { mutableStateOf(Money.decimal(loan.interestBasisPoints.toLong())) }
    var date by remember(loan.id) { mutableStateOf(dateOnly(loan.dueDate)) }
    val cents = validCents(amount)
    val basis = validCents(interest, allowZero = true)?.takeIf { it <= 1_000_000 }?.toInt()
    val candidate = remember(loan, kind, person, phone, cents, basis, date) {
        if (cents != null && basis != null) loan.copy(kind = kind, person = person.trim(), phoneNumber = phone.trim(), amountCents = cents, interestBasisPoints = basis, dueDate = if (date == dateOnly(loan.dueDate)) loan.dueDate else dateIso(date), serverTotalCents = null) else null
    }
    val total = runCatching { candidate?.totalCents }.getOrNull()
    val projected = candidate?.let { projectedBalance(balance, previous?.let(::loanBalanceEffect) ?: 0, loanBalanceEffect(it)) }
    val sufficientBalance = projected != null && projected >= 0
    val valid = person.isNotBlank() && person.length <= 100 && phone.length <= 30 && candidate != null && total != null && total in 1..Money.MAX_CENTS && total >= loan.paidCents && sufficientBalance
    EditorDialog(if (loan.amountCents == 0L) "Add loan" else "Edit loan", onDismiss, valid = valid, onConfirm = { if (valid) onSave(requireNotNull(candidate)) }) {
        if (loan.amountCents == 0L) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FilterChip(kind == "taken", { kind = "taken" }, label = { Text("Borrowed") })
            FilterChip(kind == "given", { kind = "given" }, label = { Text("Lent") })
        }
        OutlinedTextField(person, { if (it.length <= 100) person = it }, label = { Text(if (kind == "taken") "Borrowed from" else "Borrower name") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(16.dp))
        AmountField(amount, { amount = it }, label = "Principal amount", prefix = currency)
        AmountField(interest, { interest = it }, label = "Flat interest (%)")
        DateField(date, { date = it }, label = "Due date")
        if (kind == "given") OutlinedTextField(phone, { if (it.length <= 30) phone = it }, label = { Text("Phone (optional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), shape = RoundedCornerShape(16.dp))
        if (total != null && total < loan.paidCents) Text("The total cannot be less than payments already recorded.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (candidate != null && !sufficientBalance) Text("This change would leave a negative balance. Add income or update your available balance first.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}
