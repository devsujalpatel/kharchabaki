package com.kharchabaki.app.network

import com.kharchabaki.app.data.RecurringRule
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.*
import org.junit.Test

class CloudSnapshotTest {
    @Test fun `unfunded recurring expenses still allow complete ledger download`() = runTest {
        val cached = RecurringRule(id = "existing-template", amountCents = 1000, category = "rent")
        val requested = mutableSetOf<String>()
        val fetched = fetchSnapshot(load = { path ->
            requested += path
            when (path) {
                "/recurring" -> throw ApiException(400, "Insufficient balance for recurring expense")
                "/preferences" -> Json.parseToJsonElement("""{"currency":"INR","theme":"dark"}""")
                "/balance" -> Json.parseToJsonElement("""{"balance":500.25}""")
                else -> Json.parseToJsonElement("[]")
            }
        }, month = "2026-10", previousBudgets = emptyList(), previousRecurring = listOf(cached))
        assertEquals(50025L, fetched.snapshot.balanceCents)
        assertEquals(listOf(cached), fetched.snapshot.recurring)
        assertTrue(fetched.recurringError.orEmpty().contains("Insufficient balance"))
        assertTrue(requested.containsAll(listOf("/transactions", "/preferences", "/balance", "/loans/taken", "/loans/given", "/finance-labels", "/budgets?month=2026-10")))
    }

    @Test fun `taken loans preserve server totals and four-decimal paid balances`() {
        val loans = parseCloudLoans(Json.parseToJsonElement("""[{
          "id":"e4df131a-a858-47a5-95e9-4cce95e1b20d", "borrowedFrom":"Bank",
          "amount":"1000.00", "interest":"1.25", "totalAmount":"1012.50", "paidAmount":"12.5000",
          "dueDate":"2027-01-15T00:00:00.000Z", "createdAt":"2026-10-15T03:00:00.000Z",
          "payments":[{"id":"832efcbd-126c-44af-a6a0-ab5b87a57cf1","amount":"12.50",
          "paidAt":"2026-10-15T03:01:00.000Z","createdAt":"2026-10-15T03:02:00.000Z"}]
        }]"""), "taken")
        val loan = loans.single()
        assertEquals("Bank", loan.person)
        assertEquals(125, loan.interestBasisPoints)
        assertEquals(101250L, loan.totalCents)
        assertEquals(1250L, loan.paidCents)
        assertEquals(100000L, loan.remainingCents)
        assertEquals(loan.id, loan.payments.single().loanId)
    }

    @Test fun `income and expense map their separate category fields and null descriptions`() {
        val transactions = parseCloudTransactions(Json.parseToJsonElement("""[
          {"id":"income-id","type":"income","amount":"999999999999.99","source":"salary","category":null,
           "description":null,"occurredAt":"2026-10-15T03:00:00.000Z","createdAt":"2026-10-15T03:00:00.000Z"},
          {"id":"expense-id","type":"expense","amount":"0.01","source":null,"category":"food",
           "description":"Tea","occurredAt":"2026-10-14T03:00:00.000Z","createdAt":"2026-10-14T03:00:00.000Z"}
        ]"""))
        assertEquals("salary", transactions[0].category)
        assertEquals("", transactions[0].description)
        assertEquals(99999999999999L, transactions[0].amountCents)
        assertEquals("food", transactions[1].category)
        assertEquals(-1L, transactions[1].signedCents)
        assertFalse(transactions.any { it.pending })
    }

    @Test(expected = ArithmeticException::class) fun `fractional cents never silently round when loading cloud data`() {
        Json.parseToJsonElement("""{"amount":"0.0001"}""").jsonObject.cents("amount")
    }

    @Test(expected = java.io.IOException::class) fun `missing collections cannot become an empty replacement ledger`() {
        parseCloudTransactions(Json.parseToJsonElement("""{"error":"partial response"}"""))
    }
}
