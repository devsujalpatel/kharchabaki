package com.kharchabaki.app.data

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Money is always represented in hundredths of the selected currency, including JPY. */
object Money {
    const val MAX_CENTS = 99_999_999_999_999L

    fun parse(value: String): Long {
        val text = value.trim()
        require(Regex("[+-]?(?:[0-9]+(?:\\.[0-9]{0,2})?|\\.[0-9]{1,2})").matches(text)) {
            "Enter an amount with up to two decimal places."
        }
        return try {
            BigDecimal(text).movePointRight(2).longValueExact().also {
                require(it in -MAX_CENTS..MAX_CENTS) { "Amount is too large." }
            }
        } catch (_: ArithmeticException) {
            throw IllegalArgumentException("Amount is too large.")
        }
    }

    fun decimal(cents: Long): String = BigDecimal.valueOf(cents, 2).toPlainString()

    /** Database decimals may have extra trailing zeroes, e.g. taken-loan paidAmount "0.0000". */
    fun parseWire(value: String): Long = try {
        BigDecimal(value.trim()).movePointRight(2).longValueExact().also {
            require(it in -MAX_CENTS..MAX_CENTS) { "Amount is too large." }
        }
    } catch (_: ArithmeticException) {
        throw IllegalArgumentException("Saved amount must have exact cents.")
    } catch (_: NumberFormatException) {
        throw IllegalArgumentException("Saved amount is invalid.")
    }

    internal fun interestTotal(principal: Long, basisPoints: Int): Long =
        BigDecimal.valueOf(principal).multiply(BigDecimal.valueOf(10_000L + basisPoints))
            .divide(BigDecimal.valueOf(10_000), 0, RoundingMode.HALF_UP).longValueExact()
}

fun utcNow(): String = Instant.now().toString()
fun currentMonth(): String = YearMonth.now(ZoneOffset.UTC).toString()

val expenseCategories = listOf("food", "travel", "shopping", "bills", "rent", "phone", "beauty", "clothing", "fuel", "gifts", "electronics", "snacks", "drinks", "vegetables", "fruits", "repairs", "health", "education", "entertainment", "groceries", "transport", "insurance", "subscriptions", "fitness", "pets", "childcare", "donations", "taxes", "other")
val incomeSources = listOf("salary", "pocket-money", "gift", "investment", "bonus", "part-time", "freelance", "business", "rental", "interest", "dividends", "refund", "pension", "sale", "other")
val themes = listOf("light", "dark", "ocean", "forest", "sunset", "rose")
val popularCurrencies = listOf("INR", "USD", "GBP", "JPY", "EUR", "CAD", "AUD", "CNY", "CHF", "AED", "SGD", "NZD", "KRW", "BRL", "ZAR")

@Serializable
data class Preferences(val currency: String = "INR", val theme: String = "dark")

@Serializable
data class FinanceTransaction(
    val id: String = UUID.randomUUID().toString(),
    val type: String = "expense",
    val amountCents: Long = 0,
    /** Income source and expense category share this field. */
    val category: String = "other",
    val description: String = "",
    val occurredAt: String = utcNow(),
    val createdAt: String = utcNow(),
    val pending: Boolean = false,
) {
    val signedCents: Long get() = if (type == "income") amountCents else -amountCents
}

@Serializable
data class LoanPayment(
    val id: String = UUID.randomUUID().toString(),
    val loanId: String = "",
    val amountCents: Long = 0,
    val paidAt: String = utcNow(),
    val createdAt: String = utcNow(),
)

@Serializable
data class Loan(
    val id: String = UUID.randomUUID().toString(),
    val kind: String = "taken",
    val person: String = "",
    val amountCents: Long = 0,
    /** A flat percentage: 125 means 1.25%. No compound interest. */
    val interestBasisPoints: Int = 0,
    val dueDate: String = utcNow(),
    val phoneNumber: String = "",
    val createdAt: String = utcNow(),
    val payments: List<LoanPayment> = emptyList(),
    val serverTotalCents: Long? = null,
    val serverPaidCents: Long? = null,
) {
    val totalCents: Long get() = serverTotalCents ?: Money.interestTotal(amountCents, interestBasisPoints)
    val paidCents: Long get() = serverPaidCents ?: payments.sumOf { it.amountCents }
    val remainingCents: Long get() = (totalCents - paidCents).coerceAtLeast(0)
    val status: String get() = when {
        remainingCents == 0L -> "paid"
        Instant.parse(dueDate).isBefore(Instant.now()) -> "overdue"
        else -> "active"
    }
    internal val balanceEffect: Long get() = (amountCents - paidCents) * if (kind == "taken") 1 else -1
}

@Serializable
data class Budget(
    val id: String = UUID.randomUUID().toString(),
    val month: String = currentMonth(),
    val category: String = "other",
    val amountCents: Long = 0,
    val alertThreshold: Int = 80,
)

@Serializable
data class FinanceLabel(
    val id: String = UUID.randomUUID().toString(),
    val kind: String = "expense",
    val key: String = "",
    val name: String = "",
    val active: Boolean = true,
)

@Serializable
data class RecurringRule(
    val id: String = UUID.randomUUID().toString(),
    val type: String = "expense",
    val amountCents: Long = 0,
    val category: String = "other",
    val description: String = "",
    val schedule: String = "monthly",
    val interval: Int = 1,
    val startAt: String = utcNow(),
    val nextRunAt: String = startAt,
    val endAt: String? = null,
    val enabled: Boolean = true,
)

@Serializable
data class PendingMutation(
    val id: String = UUID.randomUUID().toString(),
    val method: String,
    val path: String,
    val body: JsonObject,
    val createdAt: String = utcNow(),
    val attempted: Boolean = false,
    val error: String? = null,
)

/** A complete server snapshot. Fetch all transaction pages before replacing history. */
data class RemoteSnapshot(
    val transactions: List<FinanceTransaction>,
    val balanceCents: Long,
    val preferences: Preferences,
    val loans: List<Loan> = emptyList(),
    val budgets: List<Budget> = emptyList(),
    val labels: List<FinanceLabel> = emptyList(),
    val recurring: List<RecurringRule> = emptyList(),
    val syncedAt: String = utcNow(),
)

data class FinanceState(
    val ready: Boolean = false,
    val accountId: String? = null,
    val premium: Boolean = false,
    val workspaceToken: Long = 0,
    val transactions: List<FinanceTransaction> = emptyList(),
    val preferences: Preferences = Preferences(),
    val openingBalanceCents: Long = 0,
    val loans: List<Loan> = emptyList(),
    val budgets: List<Budget> = emptyList(),
    val labels: List<FinanceLabel> = emptyList(),
    val recurring: List<RecurringRule> = emptyList(),
    val outbox: List<PendingMutation> = emptyList(),
    val lastSyncedAt: String? = null,
) {
    // Construction happens in the repository's IO worker; recomposition reads a cached total.
    val balanceCents: Long = FinanceMath.balance(openingBalanceCents, transactions, loans)
    fun transactionsForMonth(month: String): List<FinanceTransaction> = transactions.filter { it.occurredAt.startsWith(month) }
    fun spentFor(budget: Budget): Long = transactions.asSequence()
        .filter { it.type == "expense" && it.occurredAt.startsWith(budget.month) && (budget.category == "all" || it.category == budget.category) }
        .sumOf { it.amountCents }
}

object FinanceMath {
    fun balance(opening: Long, transactions: List<FinanceTransaction>, loans: List<Loan>): Long {
        var total = opening
        transactions.forEach { total = Math.addExact(total, it.signedCents) }
        loans.forEach { total = Math.addExact(total, it.balanceEffect) }
        return total
    }
}

@Serializable
internal data class FinanceDocument(
    val version: Int = 1,
    val transactions: List<FinanceTransaction> = emptyList(),
    val preferences: Preferences = Preferences(),
    val openingBalanceCents: Long = 0,
    val loans: List<Loan> = emptyList(),
    val budgets: List<Budget> = emptyList(),
    val labels: List<FinanceLabel> = emptyList(),
    val recurring: List<RecurringRule> = emptyList(),
    val outbox: List<PendingMutation> = emptyList(),
    val lastSyncedAt: String? = null,
) {
    val balanceCents: Long get() = FinanceMath.balance(openingBalanceCents, transactions, loans)
}
