package com.kharchabaki.app.ui

import com.kharchabaki.app.data.FinanceTransaction
import org.junit.Assert.assertEquals
import org.junit.Test

class TransactionScreensTest {
    @Test fun `history grouping preserves repository date and transaction order`() {
        val transactions = listOf(
            FinanceTransaction(id = "new", occurredAt = "2026-10-15T12:00:00Z"),
            FinanceTransaction(id = "older", occurredAt = "2026-10-15T08:00:00Z"),
            FinanceTransaction(id = "previous-day", occurredAt = "2026-10-14T23:00:00Z"),
        )

        val groups = groupHistoryTransactions(transactions)

        assertEquals(listOf("2026-10-15", "2026-10-14"), groups.map { it.first })
        assertEquals(listOf("new", "older"), groups.first().second.map { it.id })
        assertEquals(listOf("previous-day"), groups.last().second.map { it.id })
    }
}
