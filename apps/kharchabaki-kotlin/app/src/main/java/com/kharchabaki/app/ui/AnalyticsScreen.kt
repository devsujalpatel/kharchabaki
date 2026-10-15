package com.kharchabaki.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val chartColors = listOf(Color(0xFF34C98B), Color(0xFFEF767A), Color(0xFF5D9BF8), Color(0xFFF5B94C), Color(0xFFAA8CF8), Color(0xFF47CDE1), Color(0xFFF18ABC), Color(0xFFACCD57))
private data class CashBar(val label: String, val income: Long, val expense: Long)

@Composable
fun AnalyticsScreen(state: AppUiState) {
    var monthString by rememberSaveable { mutableStateOf(YearMonth.now(ZoneOffset.UTC).toString()) }
    val month = YearMonth.parse(monthString)
    var monthly by rememberSaveable { mutableStateOf(false) }
    val money = rememberMoneyFormatter(state.finance.preferences.currency)
    val transactions = remember(state.finance.transactions, monthString) { state.finance.transactions.filter { it.occurredAt.startsWith(monthString) } }
    val expenses = remember(transactions) { transactions.filter { it.type == "expense" }.groupBy { it.category }.map { it.key to it.value.sumOf { t -> t.amountCents } }.sortedByDescending { it.second } }
    val incomes = remember(transactions) { transactions.filter { it.type == "income" }.groupBy { it.category }.map { it.key to it.value.sumOf { t -> t.amountCents } }.sortedByDescending { it.second } }
    val bars = remember(state.finance.transactions, monthString, monthly) {
        if (monthly) (5 downTo 0).map { offset ->
            val target = month.minusMonths(offset.toLong())
            val entries = state.finance.transactions.filter { it.occurredAt.startsWith(target.toString()) }
            CashBar(target.format(DateTimeFormatter.ofPattern("MMM")), entries.filter { it.type == "income" }.sumOf { it.amountCents }, entries.filter { it.type == "expense" }.sumOf { it.amountCents })
        } else {
            val byDay = transactions.groupBy { dateOnly(it.occurredAt).dayOfMonth }
            (1..month.lengthOfMonth()).map { day ->
                val entries = byDay[day].orEmpty()
                CashBar(day.toString(), entries.filter { it.type == "income" }.sumOf { it.amountCents }, entries.filter { it.type == "expense" }.sumOf { it.amountCents })
            }
        }
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { PageHeading("Analytics", "A little perspective on your everyday money.") }
        item { MonthSelector(month) { monthString = it.toString() } }
        item {
            FinanceCard(Modifier.fillMaxWidth()) {
                Text("Cash flow", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(!monthly, { monthly = false }, label = { Text("Daily") })
                    FilterChip(monthly, { monthly = true }, label = { Text("6 months") })
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Legend("Income", incomeColor); Legend("Expenses", expenseColor)
                }
                if (bars.all { it.income == 0L && it.expense == 0L }) EmptyState("Nothing to chart yet", "Add a transaction to see your cash flow.")
                else CashFlowChart(bars, monthly)
            }
        }
        item { BreakdownCard("Where expenses go", "No expenses recorded for this month.", expenses, money) }
        item { BreakdownCard("Where income comes from", "No income recorded for this month.", incomes, money) }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun Legend(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.size(8.dp).background(color, RoundedCornerShape(3.dp)))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CashFlowChart(bars: List<CashBar>, monthly: Boolean) {
    val grid = MaterialTheme.colorScheme.outlineVariant
    val max = bars.maxOf { maxOf(it.income, it.expense) }.coerceAtLeast(1).toDouble()
    Column {
        Canvas(Modifier.fillMaxWidth().height(160.dp).semantics { contentDescription = "Cash flow chart, green for income and coral for expenses. Category totals are listed below." }) {
            for (line in 0..3) { val y = size.height / 3f * line; drawLine(grid, Offset(0f, y), Offset(size.width, y), 1.dp.toPx()) }
            val step = size.width / bars.size
            val gap = if (monthly) 3.dp.toPx() else .8.dp.toPx()
            val width = ((step - gap*3) / 2).coerceAtLeast(1f)
            bars.forEachIndexed { index, bar ->
                listOf(bar.income to incomeColor, bar.expense to expenseColor).forEachIndexed { side, pair ->
                    val height = (pair.first / max * size.height).toFloat()
                    if (height > 0) drawRoundRect(pair.second, Offset(index*step + gap + side*(width + gap), size.height-height), Size(width, height), CornerRadius(if (monthly) 3.dp.toPx() else 1.dp.toPx()))
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            if (monthly) bars.forEach { Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            else listOf("1", "7", "14", "21", bars.size.toString()).forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@Composable
private fun BreakdownCard(title: String, empty: String, items: List<Pair<String, Long>>, money: (Long) -> String) {
    val total = remember(items) { items.sumOf { it.second } }
    FinanceCard(Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text("Monthly total · ${money(total)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (total == 0L) EmptyState("No activity", empty)
        else {
            Box(Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                val background = MaterialTheme.colorScheme.surfaceVariant
                Canvas(Modifier.size(170.dp).semantics { contentDescription = "$title: ${money(total)}. Category percentages are listed below." }) {
                    val stroke = 24.dp.toPx()
                    val inset = stroke/2
                    drawArc(background, 0f, 360f, false, Offset(inset, inset), Size(size.width-stroke, size.height-stroke), style = Stroke(stroke))
                    var start = -90f
                    items.forEachIndexed { index, item ->
                        val sweep = item.second.toDouble().div(total).times(360).toFloat()
                        drawArc(chartColors[index % chartColors.size], start + .5f, (sweep - 1f).coerceAtLeast(.1f), false, Offset(inset,inset), Size(size.width-stroke,size.height-stroke), style = Stroke(stroke, cap = StrokeCap.Butt))
                        start += sweep
                    }
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(116.dp)) {
                    Text("Total", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(money(total), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
            items.forEachIndexed { index, item ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(10.dp).background(chartColors[index % chartColors.size], RoundedCornerShape(3.dp)))
                    Text(prettyLabel(item.first), Modifier.weight(1f), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("${(item.second.toDouble()/total*100).toInt()}%", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                    Text(money(item.second), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
