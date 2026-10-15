package com.kharchabaki.app.data

import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Test

class FinanceRepositoryTest {
    @Test fun moneyNeverUsesFloatingPoint() {
        assertEquals(29L, Money.parse("0.29"))
        assertEquals(10_001L, Money.parse("100.01"))
        assertEquals(-1L, Money.parse("-.01"))
        assertEquals("999999999999.99", Money.decimal(Money.MAX_CENTS))
        listOf("", "NaN", "Infinity", "1e3", "1.001", "1,000", "1000000000000", "1.2.3").forEach {
            assertThrows(IllegalArgumentException::class.java) { Money.parse(it) }
        }
    }

    @Test fun transactionChangesKeepExactBalanceAndRejectUnfundedWrites() = runTest {
        val store = MemoryStorage()
        val repo = FinanceRepository(store, StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        repo.setOpeningBalance(10_000)
        val income = transaction(type = "income", amount = 20_001)
        val expense = transaction(amount = 1_099)
        repo.saveTransaction(income)
        repo.saveTransaction(expense)
        assertEquals(28_902L, repo.state.value.balanceCents)
        repo.saveTransaction(expense.copy(amountCents = 999))
        assertEquals(29_002L, repo.state.value.balanceCents)
        expectFailure { repo.saveTransaction(transaction(amount = 30_000)) }
        assertEquals(2, repo.state.value.transactions.size)
        repo.setOpeningBalance(777)
        assertEquals(777L, repo.state.value.balanceCents)
        expectFailure { repo.deleteTransaction(income.id) }
        repo.deleteTransaction(expense.id)
        assertEquals(1_776L, repo.state.value.balanceCents)
        repo.activate("guest", false)
        assertEquals(1_776L, repo.state.value.balanceCents)
    }

    @Test fun failedPersistenceDoesNotPublishAnyPartOfAMutation() = runTest {
        val store = MemoryStorage()
        val repo = FinanceRepository(store, StandardTestDispatcher(testScheduler))
        repo.activate("account", true)
        val before = repo.state.value
        store.failWrites = true
        expectFailure { repo.saveTransaction(transaction(type = "income", amount = 100)) }
        assertEquals(before, repo.state.value)
        store.failWrites = false
        repo.activate("account", true)
        assertTrue(repo.state.value.transactions.isEmpty())
        assertTrue(repo.state.value.outbox.isEmpty())
    }

    @Test fun workspacesSeparateAccountsModesAndSeedDowngradeOnlyOnce() = runTest {
        val store = MemoryStorage()
        val repo = FinanceRepository(store, StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        repo.saveTransaction(transaction(type = "income", amount = 1_000))
        repo.activate("bob", false)
        assertTrue(repo.state.value.transactions.isEmpty())
        repo.activate("alice", false)
        assertEquals(1_000L, repo.state.value.balanceCents)
        assertTrue(repo.state.value.outbox.isEmpty())
        assertFalse(repo.state.value.transactions.single().pending)
        repo.saveTransaction(transaction(type = "income", amount = 300))
        repo.activate("alice", true)
        assertEquals(1_000L, repo.state.value.balanceCents)
        assertEquals(1, repo.state.value.outbox.size)
        repo.activate("alice", false)
        assertEquals(1_300L, repo.state.value.balanceCents)
        repo.deactivate()
        assertFalse(repo.state.value.ready)
        assertNull(repo.state.value.accountId)
    }

    @Test fun uiEventWorkspaceTokenIsCheckedInsideAtomicMutationAndRead() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("alice", false)
        val aliceToken = repo.state.value.workspaceToken
        repo.activate("bob", false)
        expectFailure { repo.withWorkspace(aliceToken) { repo.saveTransaction(transaction(type = "income", amount = 100)) } }
        expectFailure { repo.withWorkspace(aliceToken) { repo.exportCsv() } }
        assertEquals("bob", repo.state.value.accountId)
        assertTrue(repo.state.value.transactions.isEmpty())
        repo.activate("alice", false)
        expectFailure { repo.withWorkspace(aliceToken) { repo.importCsv(FinanceCsv.encode(listOf(transaction(type = "income", amount = 100)))) } }
    }

    @Test fun outboxSurvivesRestartAndFailedAcknowledgementWithoutLosingLedger() = runTest {
        val store = MemoryStorage()
        val repo = FinanceRepository(store, StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        val row = transaction(type = "income", amount = 123)
        repo.saveTransaction(row)
        val mutation = repo.state.value.outbox.single()
        assertEquals("/income", mutation.path)
        assertEquals(mutation.id, mutation.body.getValue("clientMutationId").jsonPrimitive.content)
        assertEquals("1.23", mutation.body.getValue("amount").jsonPrimitive.content)
        repo.activate("alice", true)
        assertEquals(mutation, repo.state.value.outbox.single())
        val token = repo.state.value.workspaceToken
        repo.markMutationAttempted(mutation.id, token)
        store.failWrites = true
        expectFailure { repo.acknowledgeMutation(mutation.id, token) }
        assertEquals(1, repo.state.value.outbox.size)
        store.failWrites = false
        assertTrue(repo.acknowledgeMutation(mutation.id, token))
        assertEquals(123L, repo.state.value.balanceCents)
        assertFalse(repo.state.value.transactions.single().pending)
        repo.activate("alice", true)
        assertEquals(123L, repo.state.value.balanceCents)
        assertTrue(repo.state.value.outbox.isEmpty())
    }

    @Test fun remoteSnapshotOverlaysUnsyncedEditsAndRejectsOldAccountResponses() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        val token = repo.state.value.workspaceToken
        val base = transaction(type = "income", amount = 10_000)
        val snapshot = RemoteSnapshot(listOf(base), 10_500, Preferences())
        assertTrue(repo.applyRemoteSnapshot(snapshot, token))
        repo.saveTransaction(base.copy(amountCents = 12_000))
        repo.saveTransaction(transaction(amount = 400))
        repo.savePreferences(Preferences("USD", "ocean"))
        assertTrue(repo.applyRemoteSnapshot(snapshot, token))
        assertEquals(12_100L, repo.state.value.balanceCents)
        assertEquals(Preferences("USD", "ocean"), repo.state.value.preferences)
        assertTrue(repo.state.value.transactions.all { it.pending })
        assertEquals(3, repo.state.value.outbox.size)
        repo.activate("bob", true)
        assertFalse(repo.applyRemoteSnapshot(snapshot, token))
        assertFalse(repo.acknowledgeMutation("old-id", token))
        assertEquals("bob", repo.state.value.accountId)
        assertEquals(0L, repo.state.value.balanceCents)
        repo.activate("alice", true)
        assertFalse(repo.applyRemoteSnapshot(snapshot, token))
    }

    @Test fun premiumAuxiliaryChangesStayDurableAndOverlaySnapshots() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        val token = repo.state.value.workspaceToken
        val label = FinanceLabel(key = "Coffee _ Local", name = "Coffee")
        val budget = Budget(month = "2025-01", category = label.key, amountCents = 1_000)
        val rule = RecurringRule(type = "income", category = "salary", amountCents = 100, startAt = "2030-01-01T00:00:00Z")
        repo.saveLabel(label)
        repo.saveBudget(budget)
        repo.saveRecurring(rule)
        repo.saveLabel(label.copy(name = "Renamed"))
        repo.saveRecurring(rule.copy(interval = 2))
        assertEquals(listOf("POST", "POST", "POST", "PATCH", "PATCH"), repo.state.value.outbox.map { it.method })
        assertTrue(repo.applyRemoteSnapshot(RemoteSnapshot(emptyList(), 0, Preferences()), token))
        assertEquals("Renamed", repo.state.value.labels.single().name)
        assertEquals(2, repo.state.value.recurring.single().interval)
        assertEquals(budget, repo.state.value.budgets.single())
        repo.activate("alice", true)
        assertEquals(5, repo.state.value.outbox.size)
        repo.deleteBudget(budget.id)
        repo.deleteLabel(label.id)
        repo.deleteRecurring(rule.id)
        assertTrue(repo.applyRemoteSnapshot(RemoteSnapshot(emptyList(), 0, Preferences()), repo.state.value.workspaceToken))
        assertTrue(repo.state.value.budgets.isEmpty())
        assertFalse(repo.state.value.labels.single().active)
        assertTrue(repo.state.value.recurring.isEmpty())
    }

    @Test fun budgetAcknowledgementRemapsDependentDeleteToCanonicalServerId() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        val budget = Budget(amountCents = 1_000)
        repo.saveBudget(budget)
        val create = repo.state.value.outbox.single()
        repo.deleteBudget(budget.id)
        val canonicalId = "0c036052-35de-4d94-9d07-a24a6cc73894"
        repo.acknowledgeMutation(create.id, repo.state.value.workspaceToken, buildJsonObject { put("id", canonicalId) })
        assertEquals("/budgets/$canonicalId", repo.state.value.outbox.single().path)
        assertTrue(repo.state.value.budgets.isEmpty())
        val remoteBudget = budget.copy(id = canonicalId)
        repo.applyRemoteSnapshot(RemoteSnapshot(emptyList(), 0, Preferences(), budgets = listOf(remoteBudget)), repo.state.value.workspaceToken)
        assertTrue(repo.state.value.budgets.isEmpty())
    }

    @Test fun canonicalQueueRecoveryCommitsLedgerAndQueueTogetherAndKeepsEverythingOnFailure() = runTest {
        val store = MemoryStorage()
        val repo = FinanceRepository(store, StandardTestDispatcher(testScheduler))
        repo.activate("alice", true)
        val token = repo.state.value.workspaceToken
        repo.saveTransaction(transaction(type = "income", amount = 1_000))
        repo.savePreferences(Preferences("USD", "ocean"))
        repo.saveBudget(Budget(amountCents = 100))
        val before = repo.state.value
        val serverRow = transaction(type = "income", amount = 500)
        val canonical = RemoteSnapshot(listOf(serverRow), 700, Preferences("EUR", "light"))
        store.failWrites = true
        expectFailure { repo.discardPendingAndApplySnapshot(canonical, token) }
        assertEquals(before, repo.state.value)
        store.failWrites = false
        val invalid = canonical.copy(transactions = listOf(serverRow.copy(amountCents = -1)))
        expectFailure { repo.discardPendingAndApplySnapshot(invalid, token) }
        assertEquals(before, repo.state.value)
        assertFalse(repo.discardPendingAndApplySnapshot(canonical, token - 1))
        assertEquals(before, repo.state.value)
        expectFailure { repo.discardPendingAndApplySnapshot(canonical, token, emptyList()) }
        assertEquals(before, repo.state.value)
        assertTrue(repo.discardPendingAndApplySnapshot(canonical, token, before.outbox.map { it.id }))
        assertTrue(repo.state.value.outbox.isEmpty())
        assertEquals(listOf(serverRow), repo.state.value.transactions)
        assertEquals(700L, repo.state.value.balanceCents)
        assertEquals(Preferences("EUR", "light"), repo.state.value.preferences)
        assertTrue(repo.state.value.budgets.isEmpty())
        repo.activate("alice", true)
        assertTrue(repo.state.value.outbox.isEmpty())
        assertEquals(700L, repo.state.value.balanceCents)
    }

    @Test fun loansPaymentsEditsAndDeletionReverseTheirCashEffects() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        repo.setOpeningBalance(10_000)
        val borrowed = Loan(person = "Bank", amountCents = 10_000, interestBasisPoints = 1_000, dueDate = "2030-01-01T00:00:00Z")
        repo.saveLoan(borrowed)
        assertEquals(20_000L, repo.state.value.balanceCents)
        assertEquals(11_000L, repo.state.value.loans.single().totalCents)
        expectFailure { repo.recordLoanPayment(borrowed.id, 11_001) }
        repo.recordLoanPayment(borrowed.id, 11_000)
        assertEquals("paid", repo.state.value.loans.single().status)
        assertEquals(9_000L, repo.state.value.balanceCents)
        expectFailure { repo.saveLoan(borrowed.copy(amountCents = 9_000)) }
        repo.deleteLoan(borrowed.id)
        assertEquals(10_000L, repo.state.value.balanceCents)
        val lent = Loan(kind = "given", person = "Friend", amountCents = 5_000, interestBasisPoints = 1_000, dueDate = "2030-01-01T00:00:00Z")
        repo.saveLoan(lent)
        assertEquals(5_000L, repo.state.value.balanceCents)
        repo.recordLoanPayment(lent.id, 5_500)
        assertEquals(10_500L, repo.state.value.balanceCents)
        repo.deleteLoan(lent.id)
        assertEquals(10_000L, repo.state.value.balanceCents)
    }

    @Test fun monthlyRecurrencePreservesItsDayAndNeverGeneratesDuplicates() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        val rule = RecurringRule(type = "income", amountCents = 101, category = "salary", startAt = "2025-01-31T12:00:00Z")
        repo.saveRecurring(rule)
        repo.runRecurring("2025-03-31T12:00:00Z")
        assertEquals(listOf("2025-01-31T12:00:00Z", "2025-02-28T12:00:00Z", "2025-03-31T12:00:00Z"), repo.state.value.transactions.map { it.occurredAt }.sorted())
        assertEquals("2025-04-30T12:00:00Z", repo.state.value.recurring.single().nextRunAt)
        repo.runRecurring("2025-03-31T12:00:00Z")
        assertEquals(3, repo.state.value.transactions.size)
        assertEquals(303L, repo.state.value.balanceCents)
    }

    @Test fun unfundedRecurringExpensePausesEvenWhenNoRowsWereCreated() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        repo.saveRecurring(RecurringRule(amountCents = 100, startAt = "2025-01-01T00:00:00Z"))
        repo.runRecurring("2025-01-01T00:00:00Z")
        assertFalse(repo.state.value.recurring.single().enabled)
        assertTrue(repo.state.value.transactions.isEmpty())
        assertEquals(0L, repo.state.value.balanceCents)
    }

    @Test fun leapYearRecurrenceRestoresFebruaryTwentyNinth() {
        val rule = RecurringRule(type = "income", amountCents = 1, category = "salary", schedule = "yearly", startAt = "2024-02-29T00:00:00Z")
        val doc = generateOccurrences(FinanceDocument(recurring = listOf(rule)), Instant.parse("2028-02-29T00:00:00Z"))
        assertEquals(5, doc.transactions.size)
        assertEquals("2028-02-29T00:00:00Z", doc.transactions.last().occurredAt)
    }

    @Test fun labelsArchiveWithoutBreakingHistoryAndBudgetSpendingUsesTheRightMonth() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        repo.setOpeningBalance(10_000)
        val label = FinanceLabel(key = "coffee", name = "Coffee")
        repo.saveLabel(label)
        repo.saveTransaction(transaction(amount = 500, category = "coffee"))
        val budget = Budget(month = "2025-01", category = "coffee", amountCents = 1_000)
        repo.saveBudget(budget)
        assertEquals(500L, repo.state.value.spentFor(budget))
        assertEquals(0L, repo.state.value.spentFor(budget.copy(month = "2025-02")))
        repo.deleteLabel(label.id)
        expectFailure { repo.saveTransaction(transaction(amount = 1, category = "coffee")) }
        val existing = repo.state.value.transactions.single()
        repo.saveTransaction(existing.copy(description = "Archived category kept"))
        assertEquals("coffee", repo.state.value.transactions.single().category)
        repo.activate("guest", false)
        assertFalse(repo.state.value.labels.single().active)
    }

    @Test fun financeArchiveRoundTripsAllFeaturesAndBadRestoreIsAtomic() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        repo.setOpeningBalance(10_000)
        repo.savePreferences(Preferences("EUR", "forest"))
        repo.saveTransaction(transaction(amount = 1_234))
        val loan = Loan(person = "A", amountCents = 5_000, dueDate = "2030-01-01T00:00:00Z")
        repo.saveLoan(loan)
        repo.recordLoanPayment(loan.id, 100)
        repo.saveBudget(Budget(month = "2025-01", amountCents = 2_000))
        repo.saveLabel(FinanceLabel(key = "custom", name = "Custom"))
        repo.saveRecurring(RecurringRule(type = "income", amountCents = 100, category = "salary", startAt = "2030-01-01T00:00:00Z"))
        val before = repo.state.value
        val archive = repo.exportJson()
        repo.activate("restored", false)
        repo.importJson(archive)
        val restored = repo.state.value
        assertEquals(before.transactions, restored.transactions)
        assertEquals(before.loans, restored.loans.map { it.copy(serverTotalCents = null, serverPaidCents = null) })
        assertEquals(before.balanceCents, restored.balanceCents)
        assertEquals(before.budgets, restored.budgets)
        assertEquals(before.labels, restored.labels)
        assertEquals(before.recurring, restored.recurring)
        assertEquals(before.preferences, restored.preferences)
        expectFailure { repo.importJson(archive.replace("\"amount\": \"12.34\"", "\"amount\": \"NaN\"")) }
        assertEquals(restored, repo.state.value)
    }

    @Test fun reactNativeBackupAcceptsDatabaseDecimalsWithFourPlaces() {
        val loan = Loan(person = "Bank", amountCents = 10_000, dueDate = "2030-01-01T00:00:00Z")
        val archive = FinanceArchive.encode(FinanceDocument(loans = listOf(loan)))
            .replace("\"paidAmount\": \"0.00\"", "\"paidAmount\": \"0.0000\"")
        val restored = FinanceArchive.decode(archive)
        assertEquals(0L, restored.loans.single().paidCents)
        assertEquals(10_000L, restored.balanceCents)
        assertEquals(10_000L, Money.parseWire("100.0000"))
        assertThrows(IllegalArgumentException::class.java) { Money.parseWire("100.0001") }
        assertThrows(IllegalArgumentException::class.java) { Money.parse("100.0000") }
    }

    @Test fun csvHandlesQuotesNewlinesBomAndIdempotentReimport() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        val row = transaction(type = "income", amount = 1_001).copy(description = "A, \"quote\"\r\nand a newline")
        repo.saveTransaction(row)
        val csv = repo.exportCsv()
        repo.activate("imported", false)
        repo.importCsv("\uFEFF$csv")
        repo.importCsv(csv)
        assertEquals(listOf(row), repo.state.value.transactions)
        assertEquals(1_001L, repo.state.value.balanceCents)
        val before = repo.state.value
        expectFailure { repo.importCsv(csv + "\r\n\"income\",\"NaN\",\"\",\"salary\",\"bad\",\"2025-01-01T00:00:00Z\",\"\",\"\"") }
        assertEquals(before, repo.state.value)
        expectFailure { repo.importCsv("\"type\",\"amount\",\"category\",\"source\",\"description\",\"occurredAt\"\n\"income\",\"1\",\"\",\"salary\",\"unclosed,2025-01-01T00:00:00Z") }
    }

    @Test fun csvWithoutIdsHasStableIdsButPreservesTwoIdenticalRows() {
        val csv = "type,amount,category,source,description,occurredAt\nincome,1.00,,salary,Same,2025-01-01T00:00:00Z\nincome,1.00,,salary,Same,2025-01-01T00:00:00Z"
        val rows = FinanceCsv.decode(csv)
        assertEquals(rows, FinanceCsv.decode(csv))
        assertNotEquals(rows[0].id, rows[1].id)
    }

    @Test fun premiumCsvFundsItsBatchBeforeExpensesAndPreservesEarlierQueuedChanges() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("premium", true)
        repo.savePreferences(Preferences("USD", "ocean"))
        val previousQueue = repo.state.value.outbox
        val newestExpense = transaction(amount = 400).copy(occurredAt = "2025-01-03T00:00:00Z")
        val olderExpense = transaction(amount = 200).copy(occurredAt = "2025-01-02T00:00:00Z")
        val fundingIncome = transaction(type = "income", amount = 1_000)
        val csv = FinanceCsv.encode(listOf(newestExpense, olderExpense, fundingIncome))
        repo.importCsv(csv)
        val queue = repo.state.value.outbox
        assertEquals(previousQueue, queue.take(previousQueue.size))
        val imported = queue.drop(previousQueue.size)
        assertEquals(listOf("/income", "/expense", "/expense"), imported.map { it.path })
        assertEquals(listOf(fundingIncome.id, newestExpense.id, olderExpense.id), imported.map { it.body.getValue("id").jsonPrimitive.content })
        assertEquals(listOf(fundingIncome.occurredAt, newestExpense.occurredAt, olderExpense.occurredAt), imported.map { it.body.getValue("occurredAt").jsonPrimitive.content })
        var serverBalance = 0L
        imported.forEach { mutation ->
            val amount = Money.parseWire(mutation.body.getValue("amount").jsonPrimitive.content)
            serverBalance += if (mutation.path == "/income") amount else -amount
            assertTrue("Every synced expense must have funding available", serverBalance >= 0)
        }
        assertEquals(400L, serverBalance)
        assertEquals(listOf(newestExpense.id, olderExpense.id, fundingIncome.id), repo.state.value.transactions.map { it.id })
        repo.importCsv(csv)
        assertEquals(queue, repo.state.value.outbox)
    }

    @Test fun concurrentWritersDoNotLoseRows() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        (1..50).map { async { repo.saveTransaction(transaction(type = "income", amount = 1)) } }.awaitAll()
        assertEquals(50, repo.state.value.transactions.size)
        assertEquals(50L, repo.state.value.balanceCents)
        repo.activate("guest", false)
        assertEquals(50, repo.state.value.transactions.size)
    }

    @Test fun historySortsTimestampsWithDifferentFractionalPrecisionCorrectly() = runTest {
        val repo = FinanceRepository(MemoryStorage(), StandardTestDispatcher(testScheduler))
        repo.activate("guest", false)
        val exactSecond = transaction(type = "income", amount = 1).copy(occurredAt = "2025-01-01T00:00:00Z")
        val later = transaction(type = "income", amount = 1).copy(occurredAt = "2025-01-01T00:00:00.001Z")
        repo.saveTransaction(exactSecond)
        repo.saveTransaction(later)
        assertEquals(listOf(later.id, exactSecond.id), repo.state.value.transactions.map { it.id })
    }

    private fun transaction(type: String = "expense", amount: Long, category: String = if (type == "income") "salary" else "other") =
        FinanceTransaction(type = type, amountCents = amount, category = category, occurredAt = "2025-01-01T00:00:00Z", createdAt = "2025-01-01T00:00:00Z")

    private suspend fun expectFailure(block: suspend () -> Unit) {
        try { block() } catch (_: Exception) { return }
        fail("Expected operation to fail")
    }

    private class MemoryStorage : WorkspaceStorage {
        val values = mutableMapOf<String, String>()
        var failWrites = false
        override fun read(key: String): String? = values[key]
        override fun write(key: String, content: String) {
            if (failWrites) throw IOException("Disk full")
            values[key] = content
        }
    }
}
