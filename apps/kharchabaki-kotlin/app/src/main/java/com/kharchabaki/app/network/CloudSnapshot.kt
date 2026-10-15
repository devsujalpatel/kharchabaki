package com.kharchabaki.app.network

import com.kharchabaki.app.data.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.*
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

internal data class CloudSnapshotResult(val snapshot: RemoteSnapshot, val recurringError: String? = null)

/** Fetch full transaction history so an old month's records are never erased by a partial response. */
internal suspend fun fetchSnapshot(api: ApiClient, account: String, month: String,
    previousBudgets: List<Budget>, previousRecurring: List<RecurringRule>): CloudSnapshotResult = fetchSnapshot(
        load = { path -> api.request("/api/v1$path", accountId = account).objectValue()["data"] },
        month = month, previousBudgets = previousBudgets, previousRecurring = previousRecurring)

internal suspend fun fetchSnapshot(load: suspend (String) -> JsonElement?, month: String,
    previousBudgets: List<Budget>, previousRecurring: List<RecurringRule>): CloudSnapshotResult = coroutineScope {
    suspend fun get(path: String) = load(path)
    // This endpoint generates due occurrences, so read it before fetching the affected ledger/balance.
    // An unfunded recurring expense must not prevent a fresh device from downloading existing history.
    var recurringError: String? = null
    val recurring = try { get("/recurring").rows().map { row ->
        RecurringRule(id = row.requiredString("id"), type = row.requiredString("type"),
            amountCents = row.cents("amount"), category = row.requiredString("category"),
            description = row.string("description"), schedule = row.requiredString("schedule"),
            interval = row.string("interval", "1").toInt(), startAt = row.date("startAt"),
            nextRunAt = row.date("nextRunAt"), endAt = row.nullableString("endAt")?.let { Instant.parse(it).toString() },
            enabled = row.boolean("enabled", true))
    } } catch (error: ApiException) {
        if (error.status != 400) throw error
        recurringError = "Recurring entries could not be processed: ${error.message}"
        previousRecurring
    }
    val transactionsRequest = async { get("/transactions").rows() }
    val preferencesRequest = async { get("/preferences").objectValue() }
    val balanceRequest = async { get("/balance").objectValue() }
    val takenRequest = async { get("/loans/taken").rows() }
    val givenRequest = async { get("/loans/given").rows() }
    val labelsRequest = async { get("/finance-labels").rows() }
    val budgetsRequest = async { get("/budgets?month=$month").rows() }
    val transactions = parseCloudTransactions(JsonArray(transactionsRequest.await()))
    val preferences = preferencesRequest.await().let { Preferences(it.requiredString("currency"), it.requiredString("theme")) }
    val budgets = parseCloudBudgets(JsonArray(budgetsRequest.await()))
    val labels = labelsRequest.await().map { row ->
        FinanceLabel(id = row.requiredString("id"), kind = row.requiredString("kind"), key = row.requiredString("key"),
            name = row.requiredString("name"), active = row.boolean("active", true))
    }
    CloudSnapshotResult(RemoteSnapshot(transactions = transactions, balanceCents = balanceRequest.await().cents("balance"),
        preferences = preferences, loans = parseCloudLoans(JsonArray(takenRequest.await()), "taken") + parseCloudLoans(JsonArray(givenRequest.await()), "given"),
        budgets = previousBudgets.filter { it.month != month } + budgets, labels = labels, recurring = recurring), recurringError)
}

internal fun parseCloudTransactions(value: JsonElement): List<FinanceTransaction> = value.rows().map { row ->
        val type = row.requiredString("type")
        require(type == "income" || type == "expense") { "Unknown transaction type from server." }
        FinanceTransaction(id = row.requiredString("id"), type = type, amountCents = row.cents("amount"),
            category = row.requiredString(if (type == "income") "source" else "category"),
            description = row.string("description"), occurredAt = row.date("occurredAt"), createdAt = row.date("createdAt"))
}

internal fun parseCloudLoans(value: JsonElement, kind: String): List<Loan> {
    require(kind == "given" || kind == "taken")
    return value.rows().map { row ->
        Loan(id = row.requiredString("id"), kind = kind,
            person = row.requiredString(if (kind == "given") "borrowerName" else "borrowedFrom"),
            amountCents = row.cents("amount"), interestBasisPoints = BigDecimal(row.string("interest", "0")).movePointRight(2).intValueExact(),
            dueDate = row.date("dueDate"), phoneNumber = row.string("phoneNumber"), createdAt = row.date("createdAt"),
            serverTotalCents = row.cents("totalAmount"), serverPaidCents = row.cents("paidAmount"),
            payments = (row["payments"] ?: JsonArray(emptyList())).rows().map { payment ->
                LoanPayment(id = payment.requiredString("id"), loanId = row.requiredString("id"),
                    amountCents = payment.cents("amount"), paidAt = payment.date("paidAt"), createdAt = payment.date("createdAt"))
            })
    }
}

internal fun parseCloudBudgets(value: JsonElement): List<Budget> = value.rows().map { row ->
    Budget(id = row.requiredString("id"), month = row.requiredString("month"), category = row.requiredString("category"),
        amountCents = row.cents("amount"), alertThreshold = BigDecimal(row.string("alertThreshold", "80")).toInt())
}

private fun JsonElement?.rows(): List<JsonObject> = (this as? JsonArray)?.map { it.objectValue() }
    ?: throw java.io.IOException("The server returned an incomplete collection.")
internal fun JsonObject.cents(key: String): Long = Money.parse(
    BigDecimal(requiredString(key)).setScale(2, RoundingMode.UNNECESSARY).toPlainString())
private fun JsonObject.date(key: String): String = Instant.parse(requiredString(key)).toString()
