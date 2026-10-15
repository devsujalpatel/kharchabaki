package com.kharchabaki.app.data

import android.content.Context
import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

internal interface WorkspaceStorage {
    fun read(key: String): String?
    fun write(key: String, content: String)
}

private class WorkspaceExpectation(val token: Long) : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<WorkspaceExpectation>
}

/** AtomicFile keeps the prior workspace recoverable if a write or the process fails. */
internal class AndroidWorkspaceStorage(context: Context) : WorkspaceStorage {
    private val directory by lazy { File(context.applicationContext.filesDir, "finance-workspaces") }

    private fun file(key: String): AtomicFile {
        check(directory.isDirectory || directory.mkdirs()) { "Could not create the finance storage folder." }
        val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
        val name = digest.joinToString("") { "%02x".format(it) }
        return AtomicFile(File(directory, "$name.json"))
    }

    override fun read(key: String): String? {
        val file = file(key)
        if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) return null
        return file.openRead().bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    override fun write(key: String, content: String) {
        val file = file(key)
        val stream = file.startWrite()
        try {
            stream.write(content.toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
        } catch (error: Throwable) {
            file.failWrite(stream)
            throw error
        }
    }
}

/**
 * One repository belongs to one application process. All IO, serialization, and reductions run
 * off the main thread. A mutex serializes workspace switches with durable mutations, and a
 * generation token rejects stale UI work and late responses from a previous account session.
 */
class FinanceRepository internal constructor(
    private val storage: WorkspaceStorage,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    constructor(context: Context) : this(AndroidWorkspaceStorage(context))

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(FinanceState())
    val state: StateFlow<FinanceState> = mutableState.asStateFlow()
    private var document: FinanceDocument? = null
    private var workspaceKey: String? = null
    private var generation = 0L
    private var sortedSource: List<FinanceTransaction>? = null
    private var sortedTransactions: List<FinanceTransaction> = emptyList()

    /** Carries the workspace captured by a UI event through dispatcher hops and queued writes. */
    suspend fun <T> withWorkspace(expectedToken: Long, block: suspend () -> T): T =
        withContext(WorkspaceExpectation(expectedToken)) { block() }

    suspend fun activate(accountId: String, premium: Boolean) = withContext(dispatcher) {
        require(accountId.isNotBlank() && accountId.length <= 512) { "Invalid account." }
        mutex.withLock {
            generation++
            workspaceKey = null
            document = null
            mutableState.value = FinanceState(accountId = accountId, premium = premium, workspaceToken = generation)
            val key = key(accountId, premium)
            val saved = storage.read(key)
            var loaded = if (saved != null) decode(saved) else FinanceDocument()
            // A downgraded account receives a copy once. Its local and cloud workspaces then diverge.
            if (saved == null && !premium) {
                storage.read(key(accountId, true))?.let {
                    val cloud = decode(it)
                    loaded = cloud.copy(
                        transactions = cloud.transactions.map { row -> row.copy(pending = false) },
                        outbox = emptyList(), lastSyncedAt = null,
                    )
                }
            }
            if (!premium) loaded = generateOccurrences(loaded, Instant.now())
            if (saved == null || !premium) storage.write(key, json.encodeToString(loaded))
            workspaceKey = key
            document = loaded
            publish()
        }
    }

    suspend fun deactivate() = withContext(dispatcher) {
        mutex.withLock {
            generation++
            workspaceKey = null
            document = null
            mutableState.value = FinanceState(workspaceToken = generation)
        }
    }

    suspend fun saveTransaction(transaction: FinanceTransaction) = mutate { current ->
        val previous = current.transactions.find { it.id == transaction.id }
        require(previous == null || previous.type == transaction.type) { "Create a new transaction to change its type." }
        FinanceValidation.transaction(transaction, current.labels, previous?.category == transaction.category)
        val row = transaction.copy(
            description = transaction.description.trim(), occurredAt = FinanceValidation.date(transaction.occurredAt),
            createdAt = previous?.createdAt ?: FinanceValidation.date(transaction.createdAt), pending = state.value.premium,
        )
        var next = current.copy(transactions = current.transactions.replace(row, { it.id }))
        requireBalance(next)
        if (state.value.premium) {
            val mutationId = UUID.randomUUID().toString()
            val body = buildJsonObject {
                put("id", row.id)
                put("clientMutationId", mutationId)
                put("amount", JsonPrimitive(Money.decimal(row.amountCents).toBigDecimal()))
                put(if (row.type == "income") "source" else "category", row.category)
                put("description", row.description)
                put("occurredAt", row.occurredAt)
            }
            val mutation = PendingMutation(
                id = mutationId, method = if (previous == null) "POST" else "PATCH",
                path = "/${row.type}" + if (previous == null) "" else "/${row.id}", body = body,
            )
            next = next.copy(outbox = next.outbox + mutation)
        }
        next
    }

    suspend fun deleteTransaction(id: String) = mutate { current ->
        val row = current.transactions.find { it.id == id } ?: throw IllegalArgumentException("Transaction not found.")
        var next = current.copy(transactions = current.transactions.filterNot { it.id == id })
        requireBalance(next)
        if (state.value.premium) {
            val mutationId = UUID.randomUUID().toString()
            next = next.copy(outbox = next.outbox + PendingMutation(
                id = mutationId, method = "DELETE", path = "/${row.type}/${row.id}",
                body = buildJsonObject { put("clientMutationId", mutationId) },
            ))
        }
        next
    }

    suspend fun savePreferences(preferences: Preferences) = mutate { current ->
        FinanceValidation.preferences(preferences)
        val next = current.copy(preferences = preferences)
        if (state.value.premium) next.copy(outbox = next.outbox + PendingMutation(
            method = "PATCH", path = "/preferences", body = buildJsonObject {
                put("currency", preferences.currency)
                put("theme", preferences.theme)
            },
        )) else next
    }

    /** Matches POST /balance: replaces the current balance, preserving the rest of the ledger. */
    suspend fun setOpeningBalance(cents: Long) = mutateLocal { current ->
        FinanceValidation.amount(cents, true)
        current.copy(openingBalanceCents = Math.subtractExact(cents, FinanceMath.balance(0, current.transactions, current.loans)))
    }

    suspend fun saveLoan(loan: Loan) = mutateLocal { current ->
        val previous = current.loans.find { it.id == loan.id }
        require(previous == null || previous.kind == loan.kind) { "Create a new loan to change its direction." }
        val row = loan.copy(
            person = loan.person.trim(), phoneNumber = loan.phoneNumber.trim(),
            dueDate = FinanceValidation.date(loan.dueDate), createdAt = previous?.createdAt ?: loan.createdAt,
            payments = previous?.payments ?: emptyList(), serverPaidCents = null, serverTotalCents = null,
        )
        FinanceValidation.loan(row)
        current.copy(loans = current.loans.replace(row, { it.id })).also(::requireBalance)
    }

    suspend fun deleteLoan(id: String) = mutateLocal { current ->
        require(current.loans.any { it.id == id }) { "Loan not found." }
        current.copy(loans = current.loans.filterNot { it.id == id }).also(::requireBalance)
    }

    suspend fun recordLoanPayment(id: String, amountCents: Long, paidAt: String = utcNow()) = mutateLocal { current ->
        val loan = current.loans.find { it.id == id } ?: throw IllegalArgumentException("Loan not found.")
        FinanceValidation.amount(amountCents)
        require(amountCents <= loan.remainingCents) { "Payment exceeds the outstanding amount." }
        val payment = LoanPayment(loanId = id, amountCents = amountCents, paidAt = FinanceValidation.date(paidAt))
        val nextLoan = loan.copy(payments = loan.payments + payment, serverPaidCents = null, serverTotalCents = null)
        current.copy(loans = current.loans.replace(nextLoan, { it.id })).also(::requireBalance)
    }

    suspend fun saveBudget(budget: Budget) = mutate { current ->
        FinanceValidation.budget(budget, current.labels)
        val existing = current.budgets.find { it.month == budget.month && it.category == budget.category }
        val row = budget.copy(id = existing?.id ?: budget.id)
        val next = current.copy(budgets = current.budgets.filterNot { it.id == budget.id || it.id == row.id } + row)
        enqueue(next, "POST", "/budgets", buildJsonObject {
            put("id", row.id); put("month", row.month); put("category", row.category)
            put("amount", JsonPrimitive(Money.decimal(row.amountCents).toBigDecimal())); put("alertThreshold", row.alertThreshold)
        })
    }

    suspend fun deleteBudget(id: String) = mutate { current ->
        val budget = current.budgets.find { it.id == id } ?: throw IllegalArgumentException("Budget not found.")
        enqueue(current.copy(budgets = current.budgets.filterNot { it.id == id }), "DELETE", "/budgets/$id",
            buildJsonObject { put("month", budget.month) })
    }

    suspend fun saveLabel(label: FinanceLabel) = mutate { current ->
        FinanceValidation.label(label)
        val previous = current.labels.find { it.id == label.id }
        require(previous == null || (previous.key == label.key && previous.kind == label.kind)) { "An existing category's key and type cannot be changed." }
        require(current.labels.none { it.id != label.id && it.kind == label.kind && it.key == label.key }) { "This category key already exists." }
        val row = label.copy(name = label.name.trim())
        val next = current.copy(labels = current.labels.replace(row, { it.id }))
        enqueue(next, if (previous == null) "POST" else "PATCH", if (previous == null) "/finance-labels" else "/finance-labels/${row.id}", buildJsonObject {
            put("id", row.id); put("kind", row.kind); put("key", row.key); put("name", row.name); put("active", row.active)
        })
    }

    suspend fun deleteLabel(id: String) = mutate { current ->
        require(current.labels.any { it.id == id }) { "Category not found." }
        enqueue(current.copy(labels = current.labels.map { if (it.id == id) it.copy(active = false) else it }),
            "PATCH", "/finance-labels/$id", buildJsonObject { put("active", false) })
    }

    suspend fun saveRecurring(rule: RecurringRule) = mutate { current ->
        FinanceValidation.recurring(rule, current.labels)
        val previous = current.recurring.find { it.id == rule.id }
        val next = current.copy(recurring = current.recurring.replace(rule, { it.id }))
        enqueue(next, if (previous == null) "POST" else "PATCH", if (previous == null) "/recurring" else "/recurring/${rule.id}", buildJsonObject {
            put("id", rule.id); put("type", rule.type); put("category", rule.category)
            put("amount", JsonPrimitive(Money.decimal(rule.amountCents).toBigDecimal())); put("description", rule.description)
            put("schedule", rule.schedule); put("interval", rule.interval); put("startAt", rule.startAt)
            put("nextRunAt", rule.nextRunAt); put("endAt", rule.endAt?.let(::JsonPrimitive) ?: JsonNull); put("enabled", rule.enabled)
        })
    }

    suspend fun deleteRecurring(id: String) = mutate { current ->
        require(current.recurring.any { it.id == id }) { "Schedule not found." }
        enqueue(current.copy(recurring = current.recurring.filterNot { row -> row.id == id }), "DELETE", "/recurring/$id", JsonObject(emptyMap()))
    }

    suspend fun runRecurring(now: String = utcNow()) = mutateLocal { generateOccurrences(it, Instant.parse(FinanceValidation.date(now))) }

    suspend fun exportJson(): String = readDocument {
        require(!state.value.premium) { "Full backup is available in a device-only workspace. Export cloud transactions as CSV." }
        FinanceArchive.encode(it)
    }

    suspend fun importJson(content: String) = mutateLocal { FinanceArchive.decode(content) }

    suspend fun exportCsv(): String = readDocument { FinanceCsv.encode(it.transactions) }

    /** CSV import is all-or-nothing. Stable IDs make importing the same file idempotent. */
    suspend fun importCsv(content: String) = mutate { current ->
        val rows = FinanceCsv.decode(content)
        var next = current
        // Native exports list newest first. Fund this batch before its expenses reach the server,
        // while retaining all previously queued operations and every imported ID/date unchanged.
        val orderedRows = if (state.value.premium) rows.sortedBy { if (it.type == "income") 0 else 1 } else rows
        orderedRows.forEach { row ->
            FinanceValidation.transaction(row, current.labels, allowArchived = true)
            val existing = next.transactions.find { it.id == row.id }
            require(existing == null || existing.copy(pending = false, createdAt = row.createdAt) == row.copy(pending = false)) { "A CSV record ID conflicts with an existing transaction." }
            if (existing == null) {
                next = next.copy(transactions = next.transactions + row.copy(pending = state.value.premium))
                if (state.value.premium) {
                    val mutationId = UUID.randomUUID().toString()
                    next = next.copy(outbox = next.outbox + PendingMutation(
                        id = mutationId, method = "POST", path = "/${row.type}", body = buildJsonObject {
                            put("id", row.id); put("clientMutationId", mutationId)
                            put("amount", JsonPrimitive(Money.decimal(row.amountCents).toBigDecimal()))
                            put(if (row.type == "income") "source" else "category", row.category)
                            put("description", row.description); put("occurredAt", row.occurredAt)
                        },
                    ))
                }
            }
        }
        requireBalance(next)
        next
    }

    suspend fun markMutationAttempted(id: String, token: Long): Boolean = mutateRemote(token) { current ->
        current.copy(outbox = current.outbox.map { if (it.id == id) it.copy(attempted = true, error = null) else it })
    }

    suspend fun markMutationError(id: String, error: String, token: Long): Boolean = mutateRemote(token) { current ->
        current.copy(outbox = current.outbox.map { if (it.id == id) it.copy(error = error) else it })
    }

    /** The optimistic ledger and acknowledgement are committed together, before publication. */
    suspend fun acknowledgeMutation(id: String, token: Long, responseData: JsonObject? = null): Boolean = mutateRemote(token) { current ->
        val accepted = current.outbox.find { it.id == id }
        val canonicalId = responseData?.get("id")?.jsonPrimitive?.contentOrNull
        val temporaryId = accepted?.body?.get("id")?.jsonPrimitive?.contentOrNull
        var committed = current
        // Budget POST upserts by month/category and generates a server ID. Preserve dependent deletes.
        if (accepted?.path == "/budgets" && canonicalId != null && temporaryId != null && canonicalId != temporaryId) {
            FinanceValidation.id(canonicalId)
            committed = current.copy(
                budgets = current.budgets.map { if (it.id == temporaryId) it.copy(id = canonicalId) else it },
                outbox = current.outbox.map { queued ->
                    if (queued.id == id) queued else queued.copy(
                        path = if (queued.path == "/budgets/$temporaryId") "/budgets/$canonicalId" else queued.path,
                        body = if (queued.path == "/budgets" && queued.body["id"]?.jsonPrimitive?.contentOrNull == temporaryId)
                            JsonObject(queued.body + ("id" to JsonPrimitive(canonicalId))) else queued.body,
                    )
                },
            )
        }
        val queue = committed.outbox.filterNot { it.id == id }
        committed.copy(
            outbox = queue,
            transactions = markPending(current.transactions, queue),
            lastSyncedAt = utcNow(),
        )
    }

    suspend fun applyRemoteSnapshot(snapshot: RemoteSnapshot, token: Long): Boolean = mutateRemote(token) { current ->
        val baseline = snapshot.transactions.map { it.copy(pending = false) }
        var next = current.copy(
            transactions = baseline, preferences = snapshot.preferences, loans = snapshot.loans,
            openingBalanceCents = Math.subtractExact(snapshot.balanceCents, FinanceMath.balance(0, baseline, snapshot.loans)),
            budgets = snapshot.budgets, labels = snapshot.labels, recurring = snapshot.recurring,
            lastSyncedAt = snapshot.syncedAt,
        )
        FinanceValidation.document(next.copy(outbox = emptyList()))
        current.outbox.forEach { next = overlay(next, it) }
        next
    }

    /**
     * Recovery after explicit user confirmation. The coordinator must fetch the complete canonical
     * server snapshot first. Validation and storage happen before either the outbox or ledger changes.
     */
    suspend fun discardPendingAndApplySnapshot(snapshot: RemoteSnapshot, token: Long, expectedOutboxIds: List<String>? = null): Boolean = mutateRemote(token) { current ->
        require(expectedOutboxIds == null || current.outbox.map { it.id } == expectedOutboxIds) {
            "New changes arrived while loading cloud data. Review them and try again."
        }
        val baseline = snapshot.transactions.map { it.copy(pending = false) }
        FinanceDocument(
            transactions = baseline, preferences = snapshot.preferences, loans = snapshot.loans,
            openingBalanceCents = Math.subtractExact(snapshot.balanceCents, FinanceMath.balance(0, baseline, snapshot.loans)),
            budgets = snapshot.budgets, labels = snapshot.labels, recurring = snapshot.recurring,
            lastSyncedAt = snapshot.syncedAt,
        ).also(FinanceValidation::document)
    }

    private fun overlay(current: FinanceDocument, mutation: PendingMutation): FinanceDocument {
        if (mutation.path == "/preferences") return current.copy(preferences = current.preferences.copy(
            currency = mutation.body["currency"]?.jsonPrimitive?.contentOrNull ?: current.preferences.currency,
            theme = mutation.body["theme"]?.jsonPrimitive?.contentOrNull ?: current.preferences.theme,
        ))
        val parts = mutation.path.trim('/').split('/')
        val auxiliaryId = parts.getOrNull(1) ?: mutation.body["id"]?.jsonPrimitive?.contentOrNull
        if (parts.first() == "budgets" && auxiliaryId != null) {
            if (mutation.method == "DELETE") return current.copy(budgets = current.budgets.filterNot { it.id == auxiliaryId })
            val body = mutation.body
            val row = Budget(auxiliaryId, body.getValue("month").jsonPrimitive.content, body.getValue("category").jsonPrimitive.content,
                Money.parse(body.getValue("amount").jsonPrimitive.content), body.getValue("alertThreshold").jsonPrimitive.content.toBigDecimal().intValueExact())
            return current.copy(budgets = current.budgets.filterNot { it.id == auxiliaryId || (it.month == row.month && it.category == row.category) } + row)
        }
        if (parts.first() == "finance-labels" && auxiliaryId != null) {
            val body = mutation.body
            val previous = current.labels.find { it.id == auxiliaryId }
            val row = FinanceLabel(auxiliaryId,
                body["kind"]?.jsonPrimitive?.contentOrNull ?: previous?.kind ?: return current,
                body["key"]?.jsonPrimitive?.contentOrNull ?: previous?.key ?: return current,
                body["name"]?.jsonPrimitive?.contentOrNull ?: previous?.name ?: return current,
                body["active"]?.jsonPrimitive?.contentOrNull?.toBooleanStrict() ?: previous?.active ?: true)
            return current.copy(labels = current.labels.replace(row, { it.id }))
        }
        if (parts.first() == "recurring" && auxiliaryId != null) {
            if (mutation.method == "DELETE") return current.copy(recurring = current.recurring.filterNot { it.id == auxiliaryId })
            val body = mutation.body
            val start = body.getValue("startAt").jsonPrimitive.content
            val row = RecurringRule(auxiliaryId, body.getValue("type").jsonPrimitive.content,
                Money.parse(body.getValue("amount").jsonPrimitive.content), body.getValue("category").jsonPrimitive.content,
                body["description"]?.jsonPrimitive?.contentOrNull.orEmpty(), body.getValue("schedule").jsonPrimitive.content,
                body.getValue("interval").jsonPrimitive.content.toInt(), start, body["nextRunAt"]?.jsonPrimitive?.contentOrNull ?: start,
                body["endAt"]?.jsonPrimitive?.contentOrNull, body["enabled"]?.jsonPrimitive?.contentOrNull?.toBooleanStrict() ?: true)
            return current.copy(recurring = current.recurring.replace(row, { it.id }))
        }
        if (parts.firstOrNull() !in listOf("income", "expense")) return current
        val id = parts.getOrNull(1) ?: mutation.body["id"]?.jsonPrimitive?.contentOrNull ?: return current
        if (mutation.method == "DELETE") return current.copy(transactions = current.transactions.filterNot { it.id == id })
        val previous = current.transactions.find { it.id == id }
        val row = FinanceTransaction(
            id = id, type = parts.first(), amountCents = Money.parse(mutation.body.getValue("amount").jsonPrimitive.content),
            category = mutation.body[if (parts.first() == "income") "source" else "category"]?.jsonPrimitive?.contentOrNull ?: "other",
            description = mutation.body["description"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            occurredAt = mutation.body["occurredAt"]?.jsonPrimitive?.contentOrNull ?: mutation.createdAt,
            createdAt = previous?.createdAt ?: mutation.createdAt, pending = true,
        )
        return current.copy(transactions = current.transactions.replace(row, { it.id }))
    }

    private suspend fun mutateLocal(change: (FinanceDocument) -> FinanceDocument) = mutate { current ->
        require(!state.value.premium) { "This change requires a connection in the cloud workspace." }
        change(current)
    }

    private suspend fun mutate(change: (FinanceDocument) -> FinanceDocument) {
        val token = coroutineContext[WorkspaceExpectation]?.token ?: state.value.workspaceToken
        withContext(dispatcher) {
            mutex.withLock {
                require(token == generation) { "Your account or storage mode changed. Please try again." }
                val current = requireNotNull(document) { "Finance data is not ready yet." }
                commit(change(current))
            }
        }
    }

    private suspend fun mutateRemote(token: Long, change: (FinanceDocument) -> FinanceDocument): Boolean = withContext(dispatcher) {
        mutex.withLock {
            if (token != generation || !state.value.premium || document == null) return@withLock false
            commit(change(document!!))
            true
        }
    }

    private suspend fun <T> readDocument(read: (FinanceDocument) -> T): T {
        val token = coroutineContext[WorkspaceExpectation]?.token ?: state.value.workspaceToken
        return withContext(dispatcher) {
            mutex.withLock {
                require(token == generation) { "Your account or storage mode changed. Please try again." }
                read(requireNotNull(document) { "Finance data is not ready yet." })
            }
        }
    }

    private fun commit(next: FinanceDocument) {
        if (next == document) return
        storage.write(requireNotNull(workspaceKey), json.encodeToString(next))
        document = next
        publish()
    }

    private fun publish() {
        val doc = requireNotNull(document)
        if (doc.transactions !== sortedSource) {
            // ISO strings have variable fractional precision; their lexical order is not temporal.
            sortedTransactions = doc.transactions.map { it to Instant.parse(it.occurredAt) }
                .sortedByDescending { it.second }.map { it.first }
            sortedSource = doc.transactions
        }
        mutableState.value = state.value.copy(
            ready = true, transactions = sortedTransactions,
            preferences = doc.preferences, openingBalanceCents = doc.openingBalanceCents, loans = doc.loans,
            budgets = doc.budgets, labels = doc.labels, recurring = doc.recurring,
            outbox = doc.outbox, lastSyncedAt = doc.lastSyncedAt,
        )
    }

    private fun decode(content: String): FinanceDocument = try {
        json.decodeFromString<FinanceDocument>(content).also(FinanceValidation::document)
    } catch (error: Exception) {
        throw IllegalStateException("Saved finance data could not be read. It has been preserved on this device.", error)
    }

    private fun requireBalance(value: FinanceDocument) = require(value.balanceCents >= 0) { "Insufficient balance." }
    private fun enqueue(current: FinanceDocument, method: String, path: String, body: JsonObject): FinanceDocument {
        if (!state.value.premium) return current
        val id = UUID.randomUUID().toString()
        return current.copy(outbox = current.outbox + PendingMutation(id = id, method = method, path = path,
            body = JsonObject(body + ("clientMutationId" to JsonPrimitive(id)))))
    }
    private fun key(accountId: String, premium: Boolean) = "${if (premium) "cloud" else "local"}:v1:$accountId"

    private fun markPending(rows: List<FinanceTransaction>, queue: List<PendingMutation>): List<FinanceTransaction> {
        val ids = queue.filter { it.path.startsWith("/income") || it.path.startsWith("/expense") }
            .mapNotNull { it.path.trim('/').split('/').getOrNull(1) ?: it.body["id"]?.jsonPrimitive?.contentOrNull }.toSet()
        return rows.map { it.copy(pending = it.id in ids) }
    }
}

private fun <T, K> List<T>.replace(value: T, key: (T) -> K): List<T> = filterNot { key(it) == key(value) } + value

/** UTC recurrence uses the original day as the monthly/yearly anchor (31 Jan → 28 Feb → 31 Mar). */
internal fun generateOccurrences(document: FinanceDocument, now: Instant): FinanceDocument {
    var next = document
    val knownIds = document.transactions.map { it.id }.toMutableSet()
    val generated = mutableListOf<FinanceTransaction>()
    var balance = document.balanceCents
    var remaining = 5_000 // Bounded catch-up keeps a very old schedule from monopolizing the IO worker.
    val rules = document.recurring.map { rule ->
        if (!rule.enabled) return@map rule
        var current = rule
        var due = Instant.parse(current.nextRunAt)
        val end = current.endAt?.let(Instant::parse)
        while (remaining > 0 && !due.isAfter(now) && (end == null || !due.isAfter(end))) {
            val id = UUID.nameUUIDFromBytes("recurring:${rule.id}:$due".toByteArray(Charsets.UTF_8)).toString()
            if (id !in knownIds) {
                if (current.type == "expense" && balance < current.amountCents) {
                    current = current.copy(enabled = false)
                    break
                }
                val row = FinanceTransaction(
                    id = id, type = current.type, amountCents = current.amountCents,
                    category = current.category, description = current.description,
                    occurredAt = due.toString(), createdAt = now.toString(),
                )
                generated += row
                knownIds += id
                balance = Math.addExact(balance, row.signedCents)
            }
            val date = due.atZone(ZoneOffset.UTC)
            val anchor = Instant.parse(current.startAt).atZone(ZoneOffset.UTC)
            val advanced = when (current.schedule) {
                "daily" -> date.plusDays(current.interval.toLong())
                "weekly" -> date.plusWeeks(current.interval.toLong())
                "yearly" -> {
                    val year = date.year + current.interval
                    val month = java.time.YearMonth.of(year, anchor.monthValue)
                    date.withDayOfMonth(1).withYear(year).withMonth(anchor.monthValue).withDayOfMonth(minOf(anchor.dayOfMonth, month.lengthOfMonth()))
                }
                else -> {
                    val target = java.time.YearMonth.from(date).plusMonths(current.interval.toLong())
                    date.withDayOfMonth(1).plusMonths(current.interval.toLong()).withDayOfMonth(minOf(anchor.dayOfMonth, target.lengthOfMonth()))
                }
            }
            due = advanced.toInstant()
            current = current.copy(nextRunAt = due.toString())
            remaining--
        }
        current
    }
    next = next.copy(transactions = next.transactions + generated, recurring = rules)
    return next
}
