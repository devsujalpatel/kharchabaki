import { addExpense, addIncome, type Transaction } from "@/server/transactions";
import { exportFinanceArchive, restoreFinanceArchive } from "@/lib/offline-client";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function downloadCsv(rows: Transaction[]) {
  const header = ["type", "amount", "category", "source", "description", "occurredAt"];
  const body = rows.map((row) => [row.type, row.amount, row.category, row.source, row.description, row.occurredAt].map(csvCell).join(","));
  download(new Blob([[header.map(csvCell).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" }), "kharchabaki-transactions.csv");
}
export function downloadArchive() {
  const archive = exportFinanceArchive();
  download(new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }), "kharchabaki-backup.json");
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
async function stableId(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value))).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function importCsv(file: File, setError: (value: string) => void, client: { invalidateQueries: (options: { queryKey: string[] }) => Promise<unknown> }) {
  setError("");
  try {
    const [header, ...rows] = parseCsv(await file.text());
    const columns = header?.map((value) => value.trim());
    const required = ["type", "amount", "category", "source", "description", "occurredAt"];
    if (!columns || required.some((value) => !columns.includes(value))) throw new Error("CSV must include type, amount, category, source, description, and occurredAt columns.");
    const values = rows.filter((row) => row.some(Boolean)).map((row, index) => {
      const value = Object.fromEntries(columns.map((key, column) => [key, row[column] ?? ""])) as Record<string, string>;
      const amount = Number(value.amount);
      if (!["income", "expense"].includes(value.type) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(new Date(value.occurredAt).getTime()) || !(value.type === "income" ? value.source : value.category)) throw new Error(`Invalid data on row ${index + 2}.`);
      return { type: value.type, amount, category: value.category, source: value.source, description: value.description, occurredAt: value.occurredAt };
    });
    if (!window.confirm(`Import ${values.length} transactions? The imported transactions will be added to the current workspace.`)) return;
    for (const [index, value] of values.entries()) {
      const common = { id: await stableId(`${index}:${JSON.stringify(value)}`), amount: value.amount, description: value.description || undefined, occurredAt: new Date(value.occurredAt).toISOString() };
      if (value.type === "income") await addIncome({ ...common, source: value.source });
      else await addExpense({ ...common, category: value.category });
    }
    await Promise.all(["transactions", "balance", "dashboard-summary", "budgets"].map((key) => client.invalidateQueries({ queryKey: [key] })));
  } catch (error) { setError(error instanceof Error ? error.message : "Could not import CSV."); }
}
export async function restoreArchive(file: File, setError: (value: string) => void, client: { clear: () => void }) {
  setError("");
  try {
    const archive = JSON.parse(await file.text());
    if (!window.confirm("Restore this backup and replace the current local finance workspace? This cannot be undone.")) return;
    await restoreFinanceArchive(archive);
    client.clear();
  } catch (error) { setError(error instanceof Error ? error.message : "Could not restore backup."); }
}
