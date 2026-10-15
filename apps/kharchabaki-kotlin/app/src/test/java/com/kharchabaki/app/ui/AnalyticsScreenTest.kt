package com.kharchabaki.app.ui

import com.kharchabaki.app.data.FinanceTransaction
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.YearMonth

class AnalyticsScreenTest {
    @Test fun `monthly cash bars aggregate six months in chronological order`() {
        val bars = monthlyCashBars(listOf(
            FinanceTransaction(type = "income", amountCents = 1500, occurredAt = "2026-05-12T00:00:00Z"),
            FinanceTransaction(type = "expense", amountCents = 450, occurredAt = "2026-05-13T00:00:00Z"),
            FinanceTransaction(type = "expense", amountCents = 200, occurredAt = "2026-10-01T00:00:00Z"),
            FinanceTransaction(type = "income", amountCents = 300, occurredAt = "2026-04-01T00:00:00Z"),
        ), YearMonth.of(2026, 10))

        assertEquals(listOf("May", "Jun", "Jul", "Aug", "Sep", "Oct"), bars.map { it.label })
        assertEquals(1500L, bars[0].income)
        assertEquals(450L, bars[0].expense)
        assertEquals(0L, bars[1].income)
        assertEquals(200L, bars.last().expense)
    }
}
