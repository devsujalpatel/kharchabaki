import { offlineClient } from "./offline-client";
export async function api<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  return offlineClient.request<T>(endpoint, options);
}
