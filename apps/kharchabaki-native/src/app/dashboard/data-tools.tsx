import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { Download, Upload } from "lucide-react-native";
import { usePreferences } from "@/lib/preferences";
import { addExpense, addIncome, transactionsQuery, type Transaction } from "@/services/transactions";
import { exportFinanceArchive, restoreFinanceArchive } from "@/lib/offline-client";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function toCsv(rows: Transaction[]) {
  const header = ["type", "amount", "category", "source", "description", "occurredAt"];
  return [header.map(csvCell).join(","), ...rows.map((row) => [row.type, row.amount, row.category, row.source, row.description, row.occurredAt].map(csvCell).join(","))].join("\n");
}
async function stableId(value: string) {
  const hex = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value)).slice(0, 32);
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
}
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) { const char = text[i]!; if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(value); value = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(value); rows.push(row); row = []; value = ""; } else value += char; }
  if (row.length || value) { row.push(value); rows.push(row); } return rows;
}
export default function DataToolsScreen() {
  const client = useQueryClient(); const { colors } = usePreferences(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["transactions", "all-export"], queryFn: () => transactionsQuery({ type: "all", category: "all", search: "" }) });
  const shareText = async (content: string, name: string, mimeType: string) => {
    const file = `${FileSystem.cacheDirectory}${name}`; await FileSystem.writeAsStringAsync(file, content);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file, { mimeType, dialogTitle: name }); else Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
  };
  const exportCsv = async () => { if (query.isPending) return; setBusy(true); setError(""); try { await shareText(toCsv(query.data?.data ?? []), "kharchabaki-transactions.csv", "text/csv"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not export transactions."); } finally { setBusy(false); } };
  const exportBackup = async () => { setBusy(true); setError(""); try { await shareText(JSON.stringify(exportFinanceArchive(), null, 2), "kharchabaki-backup.json", "application/json"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not export backup."); } finally { setBusy(false); } };
  const importFile = async () => {
    setError(""); const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/json"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return; setBusy(true);
    try {
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      if (result.assets[0].name.endsWith(".json")) {
        Alert.alert("Replace finance data?", "This replaces the current device-only finance workspace.", [{ text: "Cancel", style: "cancel" }, { text: "Restore", style: "destructive", onPress: () => { void restoreFinanceArchive(JSON.parse(content)).then(() => { client.clear(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not restore backup.")).finally(() => setBusy(false)); } }]);
        return;
      }
      const [header, ...lines] = parseCsv(content); const columns = header ?? []; const required = ["type", "amount", "category", "source", "description", "occurredAt"];
      if (required.some((key) => !columns.includes(key))) throw new Error("CSV is missing required columns.");
      const items = lines.filter((line) => line.some(Boolean)).map((line, index) => { const data = Object.fromEntries(columns.map((key, column) => [key, line[column] ?? ""])) as Record<string, string>; const amount = Number(data.amount); if (!["income", "expense"].includes(data.type) || !Number.isFinite(amount) || amount <= 0 || !data.occurredAt || !(data.type === "income" ? data.source : data.category)) throw new Error(`Invalid CSV row ${index + 2}.`); return { type: data.type, amount, category: data.category, source: data.source, description: data.description, occurredAt: data.occurredAt }; });
      Alert.alert("Import transactions?", `Add ${items.length} transactions to this workspace?`, [{ text: "Cancel", style: "cancel", onPress: () => setBusy(false) }, { text: "Import", onPress: () => { void (async () => { for (const [index, item] of items.entries()) { const common = { id: await stableId(`${index}:${JSON.stringify(item)}`), amount: item.amount, description: item.description || undefined, occurredAt: new Date(item.occurredAt).toISOString() }; if (item.type === "income") await addIncome({ ...common, source: item.source }); else await addExpense({ ...common, category: item.category }); } await client.invalidateQueries(); })().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not import CSV.")).finally(() => setBusy(false)); } }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not import file."); setBusy(false); }
  };
  return <ScrollView className="flex-1 bg-app-bg" contentContainerClassName="px-5 pb-8 pt-6"><Text className="text-3xl font-semibold text-app-text">Import & export</Text><Text className="mt-1 text-sm text-app-subtle">Move transactions or back up this device workspace.</Text>
    <View className="mt-6 gap-3">{[{ title: "Export transactions CSV", detail: "Share transaction history as a CSV file.", Icon: Download, action: exportCsv }, { title: "Export finance backup", detail: "Includes local transactions, loans, budgets, schedules, labels, and preferences.", Icon: Download, action: exportBackup }, { title: "Import CSV or restore backup", detail: "Validate a CSV or replace this device workspace from JSON.", Icon: Upload, action: importFile }].map(({ title, detail, Icon, action }) => <Pressable key={title} disabled={busy} onPress={() => void action()} className={`flex-row items-center gap-3 border-b border-app-border py-4 ${busy ? "opacity-50" : ""}`}><Icon size={20} color={colors.primary}/><View className="flex-1"><Text className="text-sm font-medium text-app-text">{title}</Text><Text className="mt-1 text-xs text-app-subtle">{detail}</Text></View></Pressable>)}</View>
    {busy && <ActivityIndicator className="mt-5" color={colors.primary}/>} {error && <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">{error}</Text>}
  </ScrollView>;
}
