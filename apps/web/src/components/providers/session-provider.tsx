"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import type { SessionState } from "@/lib/session-manager";
const Context = createContext<SessionState | null>(null);
export function useOfflineStatus() {
  return useSyncExternalStore(
    offlineClient.subscribe,
    offlineClient.getSnapshot,
    offlineClient.getSnapshot,
  );
}
function invalidateData(client: QueryClient, path?: string) {
  const keys =
    path === "/preferences"
      ? ["preferences"]
      : path?.startsWith("/budgets")
        ? ["budgets"]
        : path?.startsWith("/finance-labels")
          ? ["finance-labels"]
          : path?.startsWith("/recurring")
            ? ["recurring", "transactions", "balance", "dashboard-summary"]
            : path?.startsWith("/loans")
        ? ["loans", "balance", "dashboard-summary"]
        : path?.startsWith("/income") ||
            path?.startsWith("/expense") ||
            path === "/balance"
          ? ["transactions", "balance", "dashboard-summary"]
          : null;
  void client.invalidateQueries(
    keys
      ? { predicate: (query) => keys.includes(String(query.queryKey[0])) }
      : undefined,
  );
}
function AuthSessionBridge() {
  const auth = authClient.useSession();
  useEffect(() => {
    if (auth.isPending || auth.error || !offlineClient.getSnapshot().online)
      return;
    // Verify both sign-in and sign-out transitions. A free account has no cloud
    // finance requests that would otherwise detect a revoked auth session.
    if (auth.data?.session.id || sessionManager.getSnapshot().data)
      void sessionManager.refresh();
  }, [auth.data?.session.id, auth.isPending, auth.error]);
  return null;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const state = useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot,
  );
  useEffect(() => {
    const accountChanged = sessionManager.onAccountChange(() => client.clear());
    offlineClient.setOnline(navigator.onLine);
    void sessionManager.bootstrap().then(() => {
      if (sessionManager.getSnapshot().data) void offlineClient.request("/recurring").catch(() => {});
    });
    const expired = offlineClient.onUnauthorized(() => {
      void sessionManager.expire();
    });
    const channel =
      typeof BroadcastChannel === "function"
        ? new BroadcastChannel("kharchabaki-sync")
        : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === offlineClient.getAccount())
          void offlineClient.reload().then(() => client.invalidateQueries());
      };
    const changed = offlineClient.onDataChange((path?: string) => {
      channel?.postMessage(offlineClient.getAccount());
      invalidateData(client, path);
    });
    const reconnect = async () => {
      offlineClient.setOnline(true);
      if (sessionManager.getSnapshot().data?.localOnly) return;
      await sessionManager.refresh();
      if (offlineClient.getSnapshot().syncEnabled) {
        await offlineClient.flush();
        void client.invalidateQueries();
      }
    };
    const disconnected = () => offlineClient.setOnline(false);
    const foreground = () => {
      sessionManager.checkExpiry();
      if (document.visibilityState === "visible" && navigator.onLine)
        void reconnect();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnected);
    document.addEventListener("visibilitychange", foreground);
    const timer = window.setInterval(() => {
      sessionManager.checkExpiry();
      if (
        navigator.onLine &&
        offlineClient.getSnapshot().syncEnabled &&
        offlineClient.getSnapshot().pending &&
        document.visibilityState === "visible"
      )
        void reconnect();
    }, 30_000);
    return () => {
      accountChanged();
      expired();
      changed();
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnected);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [client]);
  useEffect(() => {
    if (!state.data || state.data.localOnly) return;
    const delay = Math.min(
      2_000_000_000,
      Math.max(
        0,
        new Date(state.data.session.expiresAt).getTime() - Date.now(),
      ),
    );
    const timer = setTimeout(() => sessionManager.checkExpiry(), delay);
    return () => clearTimeout(timer);
  }, [state.data]);
  useEffect(() => {
    if (!state.data?.user.isPremium || state.data.localOnly) return;
    const timer = setTimeout(() => {
      void offlineClient.request("/transactions").catch(() => {});
    }, 750);
    return () => clearTimeout(timer);
  }, [state.data?.user.id, state.data?.user.isPremium, state.data?.localOnly]);
  return (
    <Context.Provider value={state}>
      {!state.isPending && !state.data?.localOnly && <AuthSessionBridge />}
      {children}
    </Context.Provider>
  );
}
export function useAppSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
