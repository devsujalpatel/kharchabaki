package com.kharchabaki.app.data

import java.time.Instant
import java.time.YearMonth
import java.util.Currency
import java.util.UUID

internal object FinanceValidation {
    fun amount(cents: Long, zeroAllowed: Boolean = false) {
        require(cents in (if (zeroAllowed) 0 else 1)..Money.MAX_CENTS) {
            "Enter ${if (zeroAllowed) "a nonnegative" else "a positive"} amount with up to two decimal places."
        }
    }

    fun id(id: String) {
        require(runCatching { UUID.fromString(id).toString().equals(id, true) }.getOrDefault(false)) { "Invalid record ID." }
    }

    fun date(date: String): String = try {
        Instant.parse(date).toString()
    } catch (_: Exception) {
        throw IllegalArgumentException("Choose a valid date.")
    }

    fun preferences(value: Preferences) {
        require(runCatching { Currency.getInstance(value.currency) }.isSuccess) { "Choose a supported currency." }
        require(value.theme in themes) { "Choose a supported theme." }
    }

    fun category(kind: String, category: String, labels: List<FinanceLabel>, allowArchived: Boolean = false) {
        require(kind in listOf("income", "expense")) { "Choose income or expense." }
        val defaults = if (kind == "income") incomeSources + listOf("invesment", "bonues") else expenseCategories
        require(category in defaults || labels.any { it.kind == kind && it.key == category && (it.active || allowArchived) }) {
            "Choose an available source or category."
        }
    }

    fun transaction(value: FinanceTransaction, labels: List<FinanceLabel>, allowArchived: Boolean = false) {
        id(value.id)
        amount(value.amountCents)
        category(value.type, value.category, labels, allowArchived)
        require(value.description.length <= 1000) { "Keep notes under 1000 characters." }
        date(value.occurredAt)
        date(value.createdAt)
    }

    fun loan(value: Loan) {
        id(value.id)
        require(value.kind in listOf("taken", "given")) { "Choose borrowed or lent." }
        amount(value.amountCents)
        require(value.interestBasisPoints in 0..1_000_000) { "Enter a valid interest percentage." }
        require(value.person.isNotBlank() && value.person.length <= 100) { "Enter a person or bank name under 100 characters." }
        require(value.phoneNumber.length <= 30) { "Keep the mobile number under 30 characters." }
        date(value.dueDate)
        date(value.createdAt)
        unique(value.payments.map { it.id })
        value.payments.forEach {
            id(it.id)
            require(it.loanId == value.id) { "A payment belongs to another loan." }
            amount(it.amountCents)
            date(it.paidAt)
            date(it.createdAt)
        }
        amount(value.totalCents)
        amount(value.paidCents, true)
        require(value.paidCents <= value.totalCents) { "Payments exceed the loan total." }
        require(value.serverPaidCents == null || value.payments.isEmpty() || value.serverPaidCents == value.payments.sumOf { it.amountCents }) {
            "Loan payment totals do not match."
        }
    }

    fun budget(value: Budget, labels: List<FinanceLabel>) {
        id(value.id)
        require(runCatching { YearMonth.parse(value.month).toString() == value.month }.getOrDefault(false)) { "Choose a valid month." }
        if (value.category != "all") category("expense", value.category, labels, allowArchived = true)
        amount(value.amountCents)
        require(value.alertThreshold in 1..100) { "Choose an alert threshold from 1 to 100." }
    }

    fun label(value: FinanceLabel) {
        id(value.id)
        require(value.kind in listOf("income", "expense")) { "Choose a label type." }
        require(value.key.isNotBlank() && value.key.length <= 100 && Regex("[a-zA-Z0-9 _-]+").matches(value.key)) { "Use a category key with letters, numbers, spaces, underscores, or hyphens." }
        require(value.name.isNotBlank() && value.name.length <= 60) { "Enter a name under 60 characters." }
    }

    fun recurring(value: RecurringRule, labels: List<FinanceLabel>) {
        id(value.id)
        amount(value.amountCents)
        category(value.type, value.category, labels, allowArchived = true)
        require(value.description.length <= 1000) { "Keep notes under 1000 characters." }
        require(value.schedule in listOf("daily", "weekly", "monthly", "yearly")) { "Choose a recurring schedule." }
        require(value.interval in 1..365) { "Choose an interval from 1 to 365." }
        val start = Instant.parse(date(value.startAt))
        require(!Instant.parse(date(value.nextRunAt)).isBefore(start)) { "Next occurrence cannot precede the start date." }
        value.endAt?.let { require(!Instant.parse(date(it)).isBefore(start)) { "End date cannot precede the start date." } }
    }

    fun document(value: FinanceDocument) {
        require(value.version == 1) { "This workspace uses an unsupported format." }
        preferences(value.preferences)
        unique(value.transactions.map { it.id })
        unique(value.loans.map { it.id })
        unique(value.budgets.map { it.id })
        unique(value.labels.map { it.id })
        unique(value.recurring.map { it.id })
        value.labels.forEach(::label)
        require(value.labels.distinctBy { it.kind to it.key }.size == value.labels.size) { "Duplicate category keys." }
        value.transactions.forEach { transaction(it, value.labels, true) }
        value.loans.forEach(::loan)
        value.budgets.forEach { budget(it, value.labels) }
        value.recurring.forEach { recurring(it, value.labels) }
        // Server reconciliation can expose a temporarily unfunded optimistic expense.
        require(value.balanceCents >= 0 || value.outbox.isNotEmpty()) { "Insufficient balance." }
    }

    private fun unique(ids: List<String>) = require(ids.distinct().size == ids.size) { "Duplicate record IDs." }
}
