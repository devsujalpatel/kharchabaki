import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { authClient } from "./auth-client";
import { OfflineClient } from "./offline-engine";
import { SessionManager } from "./session-manager";
export async function transport(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const cookie = await authClient.getCookie();
  if (cookie) headers.set("Cookie", cookie);
  headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1${path}`, {
      ...init,
      headers,
      credentials: "omit",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
export const offlineClient = new OfflineClient(AsyncStorage, transport, randomUUID);
export const sessionManager = new SessionManager(AsyncStorage, offlineClient, transport);
export const exportFinanceArchive = () => offlineClient.exportFinanceArchive();
export const restoreFinanceArchive = (value: unknown) => offlineClient.restoreFinanceArchive(value);
