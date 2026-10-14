import { OfflineClient, type LocalStorageAdapter } from "./offline-engine";
import { SessionManager } from "./session-manager";
let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("kharchabaki-offline", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("account-data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = null;
      reject(
        new Error(
          "Local storage is unavailable. Allow site storage to save offline.",
        ),
      );
    };
  });
  return database;
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("account-data", mode);
    const request = run(transaction.objectStore("account-data"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () =>
      reject(
        new Error(
          "Could not save on this device. Free some storage and retry.",
        ),
      );
  });
}
export const deviceStorage: LocalStorageAdapter = {
  async getItem(key) {
    return (await operation("readonly", (store) => store.get(key))) ?? null;
  },
  async setItem(key, value) {
    await operation("readwrite", (store) => store.put(value, key));
  },
  async removeItem(key) {
    await operation("readwrite", (store) => store.delete(key));
  },
  async runExclusive(key, work) {
    return navigator.locks
      ? navigator.locks.request(`kharchabaki:${key}`, work)
      : work();
  },
};
export async function transport(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(`/api/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
export const offlineClient = new OfflineClient(deviceStorage, transport, () =>
  crypto.randomUUID(),
);
export const sessionManager = new SessionManager(
  deviceStorage,
  offlineClient,
  transport,
);
export const exportFinanceArchive = () => offlineClient.exportFinanceArchive();
export const restoreFinanceArchive = (value: unknown) => offlineClient.restoreFinanceArchive(value);
