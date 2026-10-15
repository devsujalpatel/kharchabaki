package com.kharchabaki.app.data

import java.time.Instant
import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Compatible with the React Native app's kharchabaki-finance v1 full backup. */
internal object FinanceArchive {
    private val json = Json { prettyPrint = true }
    private const val MAX_IMPORT_CHARS = 20 * 1024 * 1024

    fun encode(document: FinanceDocument): String = json.encodeToString(JsonObject.serializer(), buildJsonObject {
        put("format", "kharchabaki-finance")
        put("version", 1)
        put("exportedAt", utcNow())
        put("records", JsonArray(document.transactions.map { row -> buildJsonObject {
            put("id", row.id); put("type", row.type); put("amount", Money.decimal(row.amountCents))
            put("category", if (row.type == "expense") JsonPrimitive(row.category) else JsonNull)
            put("source", if (row.type == "income") JsonPrimitive(row.category) else JsonNull)
            put("description", row.description); put("occurredAt", row.occurredAt); put("createdAt", row.createdAt)
        } }))
        put("balance", JsonPrimitive(Money.decimal(document.balanceCents).toBigDecimal()))
        put("loans", buildJsonObject {
            for (kind in listOf("taken", "given")) put(kind, JsonArray(document.loans.filter { it.kind == kind }.map(::loanJson)))
        })
        put("budgets", buildJsonObject {
            document.budgets.groupBy { it.month }.forEach { (month, rows) -> put(month, JsonArray(rows.map { row -> buildJsonObject {
                put("id", row.id); put("month", row.month); put("category", row.category)
                put("amount", Money.decimal(row.amountCents)); put("alertThreshold", row.alertThreshold)
            } })) }
        })
        put("labels", buildJsonObject { put("all", JsonArray(document.labels.map { row -> buildJsonObject {
            put("id", row.id); put("kind", row.kind); put("key", row.key); put("name", row.name); put("active", row.active)
        } })) })
        put("recurring", buildJsonObject { put("all", JsonArray(document.recurring.map { row -> buildJsonObject {
            put("id", row.id); put("type", row.type); put("category", row.category); put("amount", Money.decimal(row.amountCents))
            put("description", row.description); put("schedule", row.schedule); put("interval", row.interval)
            put("startAt", row.startAt); put("nextRunAt", row.nextRunAt)
            put("endAt", row.endAt?.let(::JsonPrimitive) ?: JsonNull); put("enabled", row.enabled)
        } })) })
        put("preferences", buildJsonObject { put("currency", document.preferences.currency); put("theme", document.preferences.theme) })
    })

    fun decode(content: String): FinanceDocument {
        require(content.length <= MAX_IMPORT_CHARS) { "Choose a backup smaller than 20 MB." }
        try {
            val root = json.parseToJsonElement(content).jsonObject
            require(root.text("format") == "kharchabaki-finance" && root.text("version") == "1") { "This is not a supported Kharchabaki backup." }
            val labels = root.objectValue("labels").values.flatMap { it.array() }.map { element ->
                val row = element.jsonObject
                FinanceLabel(row.text("id"), row.text("kind"), row.text("key"), row.text("name"), row.boolean("active", true))
            }
            val transactions = root.getValue("records").array().map { element ->
                val row = element.jsonObject
                FinanceTransaction(
                    id = row.text("id"), type = row.text("type"), amountCents = Money.parseWire(row.text("amount")),
                    category = row.text(if (row.text("type") == "income") "source" else "category"),
                    description = row.optionalText("description").orEmpty(),
                    occurredAt = FinanceValidation.date(row.text("occurredAt")),
                    createdAt = FinanceValidation.date(row.optionalText("createdAt") ?: row.text("occurredAt")),
                )
            }
            require(transactions.size <= 100_000) { "This archive has too many transactions." }
            val loanGroups = root.getValue("loans").jsonObject
            val loans = listOf("taken", "given").flatMap { kind -> loanGroups.getValue(kind).array().map { parseLoan(it.jsonObject, kind) } }
            val budgets = root.objectValue("budgets").flatMap { (month, values) -> values.array().map { element ->
                val row = element.jsonObject
                Budget(row.text("id"), month, row.text("category"), Money.parseWire(row.text("amount")), decimalInteger(row, "alertThreshold", 80))
            } }
            val recurring = root.objectValue("recurring").values.flatMap { it.array() }.map { element ->
                val row = element.jsonObject
                val start = FinanceValidation.date(row.text("startAt"))
                RecurringRule(
                    id = row.text("id"), type = row.text("type"), amountCents = Money.parseWire(row.text("amount")), category = row.text("category"),
                    description = row.optionalText("description").orEmpty(), schedule = row.text("schedule"),
                    interval = decimalInteger(row, "interval", 1), startAt = start,
                    nextRunAt = FinanceValidation.date(row.optionalText("nextRunAt") ?: start),
                    endAt = row.optionalText("endAt")?.let(FinanceValidation::date), enabled = row.boolean("enabled", true),
                )
            }
            val prefs = root.objectValue("preferences")
            val balance = Money.parseWire(root.text("balance"))
            require(balance >= 0) { "The backup contains a negative balance." }
            return FinanceDocument(
                transactions = transactions, loans = loans, budgets = budgets, labels = labels, recurring = recurring,
                preferences = Preferences(prefs.optionalText("currency") ?: "INR", prefs.optionalText("theme") ?: "dark"),
                openingBalanceCents = Math.subtractExact(balance, FinanceMath.balance(0, transactions, loans)),
            ).also(FinanceValidation::document)
        } catch (error: IllegalArgumentException) {
            throw error
        } catch (error: Exception) {
            throw IllegalArgumentException("The backup contains invalid finance data.", error)
        }
    }

    private fun loanJson(loan: Loan) = buildJsonObject {
        put("id", loan.id); put("amount", Money.decimal(loan.amountCents)); put("totalAmount", Money.decimal(loan.totalCents))
        put("paidAmount", Money.decimal(loan.paidCents)); put("interest", Money.decimal(loan.interestBasisPoints.toLong()))
        put(if (loan.kind == "taken") "borrowedFrom" else "borrowerName", loan.person)
        put("phoneNumber", loan.phoneNumber); put("dueDate", loan.dueDate); put("createdAt", loan.createdAt); put("status", loan.status)
        put("payments", JsonArray(loan.payments.map { row -> buildJsonObject {
            put("id", row.id); put("loanId", row.loanId); put("amount", Money.decimal(row.amountCents))
            put("paidAt", row.paidAt); put("createdAt", row.createdAt)
        } }))
    }

    private fun parseLoan(row: JsonObject, kind: String): Loan {
        val id = row.text("id")
        val created = FinanceValidation.date(row.text("createdAt"))
        var payments = (row["payments"] ?: JsonArray(emptyList())).array().map { element ->
            val payment = element.jsonObject
            LoanPayment(
                payment.text("id"), payment.text("loanId"), Money.parseWire(payment.text("amount")),
                FinanceValidation.date(payment.text("paidAt")), FinanceValidation.date(payment.optionalText("createdAt") ?: payment.text("paidAt")),
            )
        }
        val paid = Money.parseWire(row.text("paidAmount"))
        // Older loan exports can contain only paidAmount. Preserve their balance and repayment history.
        if (payments.isEmpty() && paid > 0) payments = listOf(LoanPayment(
            id = UUID.nameUUIDFromBytes("legacy-loan-payment:$id".toByteArray(Charsets.UTF_8)).toString(),
            loanId = id, amountCents = paid, paidAt = created, createdAt = created,
        ))
        require(payments.sumOf { it.amountCents } == paid) { "Loan payments do not match the paid total." }
        return Loan(
            id = id, kind = kind, person = row.text(if (kind == "taken") "borrowedFrom" else "borrowerName"),
            amountCents = Money.parseWire(row.text("amount")), interestBasisPoints = Math.toIntExact(Money.parseWire(row.optionalText("interest") ?: "0")),
            dueDate = FinanceValidation.date(row.text("dueDate")), phoneNumber = row.optionalText("phoneNumber").orEmpty(), createdAt = created,
            payments = payments, serverTotalCents = Money.parseWire(row.text("totalAmount")), serverPaidCents = paid,
        )
    }

    private fun decimalInteger(row: JsonObject, key: String, default: Int): Int =
        row.optionalText(key)?.toBigDecimal()?.intValueExact() ?: default
}

/** RFC 4180 quoting, UTF-8 BOM support, and native-app compatible column names. */
internal object FinanceCsv {
    private val columns = listOf("type", "amount", "category", "source", "description", "occurredAt", "id", "createdAt")

    fun encode(rows: List<FinanceTransaction>): String = buildString {
        append(columns.joinToString(",", transform = ::cell))
        rows.forEach { row ->
            append("\r\n")
            append(listOf(row.type, Money.decimal(row.amountCents), if (row.type == "expense") row.category else "", if (row.type == "income") row.category else "", row.description, row.occurredAt, row.id, row.createdAt).joinToString(",", transform = ::cell))
        }
    }

    fun decode(content: String): List<FinanceTransaction> {
        require(content.length <= 20 * 1024 * 1024) { "Choose a CSV smaller than 20 MB." }
        val lines = parse(content.removePrefix("\uFEFF"))
        require(lines.isNotEmpty()) { "CSV is empty." }
        val header = lines.first().map(String::trim)
        require(header.distinct().size == header.size && columns.take(6).all { it in header }) { "CSV is missing required columns." }
        val rows = lines.drop(1).filter { line -> line.any { it.isNotBlank() } }
        require(rows.size <= 100_000) { "CSV has too many transactions." }
        return rows.mapIndexed { index, values ->
            require(values.size == header.size) { "CSV row ${index + 2} has an unexpected number of columns." }
            val row = header.zip(values).toMap()
            val type = row.getValue("type").trim()
            val amount = Money.parse(row.getValue("amount"))
            val occurredAt = FinanceValidation.date(row.getValue("occurredAt"))
            val category = row.getValue(if (type == "income") "source" else "category").trim()
            val description = row.getValue("description")
            val stableSeed = listOf(index.toString(), type, Money.decimal(amount), category, description, occurredAt)
                .joinToString("\u0000")
            val id = row["id"]?.takeIf(String::isNotBlank) ?: UUID.nameUUIDFromBytes(stableSeed.toByteArray(Charsets.UTF_8)).toString()
            FinanceTransaction(
                id = id, type = type, amountCents = amount, category = category, description = description,
                occurredAt = occurredAt, createdAt = FinanceValidation.date(row["createdAt"]?.takeIf(String::isNotBlank) ?: occurredAt),
            )
        }.also { require(it.map(FinanceTransaction::id).distinct().size == it.size) { "CSV contains duplicate transaction IDs." } }
    }

    private fun cell(value: String): String = "\"${value.replace("\"", "\"\"")}\""

    private fun parse(content: String): List<List<String>> {
        val rows = mutableListOf<List<String>>()
        var row = mutableListOf<String>()
        val value = StringBuilder()
        var quoted = false
        var closedQuote = false
        var index = 0
        while (index < content.length) {
            val char = content[index]
            when {
                quoted && char == '"' && content.getOrNull(index + 1) == '"' -> { value.append('"'); index++ }
                quoted && char == '"' -> { quoted = false; closedQuote = true }
                quoted -> value.append(char)
                char == '"' -> {
                    require(value.isEmpty() && !closedQuote) { "CSV contains a misplaced quote." }
                    quoted = true
                }
                char == ',' -> { row += value.toString(); value.setLength(0); closedQuote = false }
                char == '\r' || char == '\n' -> {
                    if (char == '\r' && content.getOrNull(index + 1) == '\n') index++
                    row += value.toString(); rows += row; row = mutableListOf(); value.setLength(0); closedQuote = false
                }
                else -> {
                    require(!closedQuote) { "CSV has text after a closing quote." }
                    value.append(char)
                }
            }
            index++
        }
        require(!quoted) { "CSV contains an unclosed quote." }
        if (row.isNotEmpty() || value.isNotEmpty() || closedQuote) { row += value.toString(); rows += row }
        return rows
    }
}

private fun JsonElement.array(): List<JsonElement> = this as? JsonArray ?: throw IllegalArgumentException("Expected a list in the backup.")
private fun JsonObject.optionalText(key: String): String? = get(key)?.jsonPrimitive?.contentOrNull
private fun JsonObject.text(key: String): String = requireNotNull(optionalText(key)) { "The backup is missing $key." }
private fun JsonObject.objectValue(key: String): JsonObject = get(key)?.jsonObject ?: JsonObject(emptyMap())
private fun JsonObject.boolean(key: String, default: Boolean): Boolean = when (val text = optionalText(key)) {
    null -> default
    "true" -> true
    "false" -> false
    else -> throw IllegalArgumentException("Invalid boolean $text in the backup.")
}
