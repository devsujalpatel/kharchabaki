package com.kharchabaki.app.ui

import android.app.DatePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.kharchabaki.app.data.Money
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

@Composable
fun rememberMoneyFormatter(currency: String): (Long) -> String {
    val format = remember(currency) {
        NumberFormat.getCurrencyInstance(if (currency == "INR") Locale.forLanguageTag("en-IN") else Locale.US).apply {
            val selected = runCatching { Currency.getInstance(currency) }.getOrDefault(Currency.getInstance("INR"))
            this.currency = selected
            val precision = selected.defaultFractionDigits.takeIf { it >= 0 } ?: 2
            minimumFractionDigits = precision
            maximumFractionDigits = precision
        }
    }
    return remember(format) { { value: Long -> format.format(java.math.BigDecimal.valueOf(value, 2)) } }
}

fun prettyLabel(value: String): String = value.replace("invesment", "investment").replace("bonues", "bonus")
    .split('-', ' ').filter { it.isNotBlank() }.joinToString(" ") { it.replaceFirstChar(Char::titlecase) }
fun utcToday(): LocalDate = LocalDate.now(ZoneOffset.UTC)
fun dateOnly(value: String): LocalDate = runCatching { LocalDate.parse(value.take(10)) }.getOrDefault(utcToday())
fun dateIso(value: LocalDate): String = value.atStartOfDay().toInstant(ZoneOffset.UTC).toString()
fun validCents(value: String, allowZero: Boolean = false): Long? = runCatching { Money.parse(value.trim()) }
    .getOrNull()?.takeIf { if (allowZero) it >= 0 else it > 0 }
fun projectedBalance(current: Long, previousEffect: Long, nextEffect: Long): Long? =
    runCatching { Math.addExact(Math.subtractExact(current, previousEffect), nextEffect) }.getOrNull()

@Composable
fun PageHeading(title: String, subtitle: String? = null, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold, letterSpacing = (-1).sp)
            if (subtitle != null) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 5.dp))
        }
        action?.invoke()
    }
}

@Composable
fun FinanceCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
fun MonthSelector(month: YearMonth, onChange: (YearMonth) -> Unit) {
    var pick by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        TextButton(onClick = { onChange(month.minusMonths(1)) }, modifier = Modifier.semantics { contentDescription = "Previous month" }) { Text("‹", fontSize = 30.sp) }
        TextButton(onClick = { pick = true }) { Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy")), fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onBackground) }
        TextButton(onClick = { onChange(month.plusMonths(1)) }, modifier = Modifier.semantics { contentDescription = "Next month" }) { Text("›", fontSize = 30.sp) }
    }
    if (pick) {
        var year by remember(month) { mutableIntStateOf(month.year) }
        AlertDialog(onDismissRequest = { pick = false }, title = { Text("Choose month") }, text = {
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { if (year > 1900) year-- }) { Text("‹", fontSize = 24.sp) }
                    Text(year.toString(), style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { if (year < 9999) year++ }) { Text("›", fontSize = 24.sp) }
                }
                (0..3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        (1..3).forEach { column ->
                            val number = row * 3 + column
                            TextButton(onClick = { onChange(YearMonth.of(year, number)); pick = false }, modifier = Modifier.weight(1f)) {
                                Text(YearMonth.of(year, number).format(DateTimeFormatter.ofPattern("MMM")), color = if (year == month.year && number == month.monthValue) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                }
            }
        }, confirmButton = { TextButton(onClick = { onChange(YearMonth.now(ZoneOffset.UTC)); pick = false }) { Text("This month") } }, dismissButton = { TextButton(onClick = { pick = false }) { Text("Cancel") } })
    }
}

@Composable
fun EditorDialog(title: String, onDismiss: () -> Unit, confirmLabel: String = "Save", valid: Boolean = true, onConfirm: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val windowSize = LocalWindowInfo.current.containerSize
    val maxHeight = with(LocalDensity.current) { windowSize.height.toDp() * .88f }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().padding(16.dp).imePadding().heightIn(max = maxHeight), shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(22.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = onDismiss, modifier = Modifier.semantics { contentDescription = "Close" }) { Text("✕", fontSize = 20.sp) }
                }
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
                Spacer(Modifier.height(20.dp))
                Button(onClick = onConfirm, enabled = valid, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(16.dp)) { Text(confirmLabel, fontWeight = FontWeight.SemiBold) }
            }
        }
    }
}

@Composable
fun AmountField(value: String, onChange: (String) -> Unit, label: String = "Amount", prefix: String? = null) {
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, prefix = prefix?.let { { Text(it) } }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), shape = RoundedCornerShape(16.dp))
}

@Composable
fun DateField(value: LocalDate, onChange: (LocalDate) -> Unit, label: String = "Date") {
    val context = LocalContext.current
    OutlinedButton(onClick = { DatePickerDialog(context, { _, y, m, d -> onChange(LocalDate.of(y, m + 1, d)) }, value.year, value.monthValue - 1, value.dayOfMonth).show() },
        Modifier.fillMaxWidth().heightIn(min = 56.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        Text(value.format(DateTimeFormatter.ofPattern("dd MMM yyyy")), color = MaterialTheme.colorScheme.onSurface)
        Text("  ▦", color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun ChoiceField(label: String, value: String, options: List<String>, onChange: (String) -> Unit, display: (String) -> String = ::prettyLabel) {
    var show by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { show = true }, Modifier.fillMaxWidth().heightIn(min = 56.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(14.dp))
        Text(display(value).ifBlank { "Choose" }, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurface)
        Text("⌄")
    }
    if (show) {
        var query by remember { mutableStateOf("") }
        val choices = remember(options, query) { options.distinct().filter { display(it).contains(query, ignoreCase = true) } }
        AlertDialog(onDismissRequest = { show = false }, title = { Text(label) }, text = {
            Column {
                OutlinedTextField(query, { query = it }, label = { Text("Search") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp))
                androidx.compose.foundation.lazy.LazyColumn(Modifier.heightIn(max = 340.dp).padding(top = 10.dp)) {
                    items(choices.size, key = { choices[it] }) { index ->
                        val choice = choices[index]
                        Row(Modifier.fillMaxWidth().clickable { onChange(choice); show = false }.padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(display(choice), Modifier.weight(1f), color = if (choice == value) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                            if (choice == value) Text("✓", color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }, confirmButton = { TextButton(onClick = { show = false }) { Text("Close") } })
    }
}

@Composable
fun EmptyState(title: String, description: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("◌", fontSize = 44.sp, color = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}
