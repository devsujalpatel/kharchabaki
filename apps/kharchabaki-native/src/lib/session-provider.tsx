import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { focusManager, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import { offlineClient, sessionManager } from "./offline-client";
import type { SessionState } from "./session-manager";
const Context = createContext<SessionState | null>(null);
export function useOfflineStatus() {
  return useSyncExternalStore(
    offlineClient.subscribe,
    offlineClient.getSnapshot,
    offlineClient.getSnapshot
  );
}
function invalidateData(client: QueryClient, path?: string) {
  const keys =
    path === "/preferences"
      ? ["preferences"]
      : path?.startsWith("/loans")
        ? ["loans", "balance", "dashboard-summary"]
        : path?.startsWith("/income") || path?.startsWith("/expense") || path === "/balance"
          ? ["transactions", "balance", "dashboard-summary"]
          : null;
  void client.invalidateQueries(
    keys ? { predicate: (query) => keys.includes(String(query.queryKey[0])) } : undefined
  );
}
function AuthSessionBridge() {
  const auth = authClient.useSession();
  useEffect(() => {
    if (auth.isPending || auth.error || !offlineClient.getSnapshot().online) return;
    // Verify both sign-in and sign-out transitions. A free account has no cloud
    // finance requests that would otherwise detect a revoked auth session.
    if (auth.data?.session.id || sessionManager.getSnapshot().data) void sessionManager.refresh();
  }, [auth.data?.session.id, auth.isPending, auth.error]);
  return null;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const state = useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot
  );
  useEffect(() => {
    const accountChanged = sessionManager.onAccountChange(() => client.clear());
    // Restore device data immediately; connectivity does not block the first screen.
    void sessionManager.bootstrap();
    const expired = offlineClient.onUnauthorized(() => {
      void sessionManager.expire();
    });
    const changes = new Set<string>();
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    const changed = offlineClient.onDataChange((path?: string) => {
      changes.add(path ?? "all");
      if (changeTimer) return;
      changeTimer = setTimeout(() => {
        changeTimer = null;
        if (changes.has("all")) invalidateData(client);
        else for (const value of changes) invalidateData(client, value);
        changes.clear();
      }, 32);
    });
    const reconnect = async () => {
      if (sessionManager.getSnapshot().data?.localOnly) return;
      await sessionManager.refresh();
      if (offlineClient.getSnapshot().syncEnabled) {
        await offlineClient.flush();
        void client.invalidateQueries();
      }
    };
    const updateConnection = (value: {
      isConnected?: boolean | null;
      isInternetReachable?: boolean | null;
    }) => {
      const wasOnline = offlineClient.getSnapshot().online;
      const online = value.isConnected !== false && value.isInternetReachable !== false;
      offlineClient.setOnline(online);
      if (online && !wasOnline) void reconnect();
    };
    void Network.getNetworkStateAsync()
      .then(updateConnection)
      .catch(() => {});
    const network = Network.addNetworkStateListener(updateConnection);
    const active = AppState.addEventListener("change", (value) => {
      focusManager.setFocused(value === "active");
      sessionManager.checkExpiry();
      if (value === "active" && !sessionManager.getSnapshot().data?.localOnly)
        void Network.getNetworkStateAsync()
          .then((value) => {
            updateConnection(value);
            if (offlineClient.getSnapshot().online) void reconnect();
          })
          .catch(() => {});
    });
    const timer = setInterval(() => {
      sessionManager.checkExpiry();
      if (
        AppState.currentState === "active" &&
        offlineClient.getSnapshot().syncEnabled &&
        offlineClient.getSnapshot().pending
      )
        void Network.getNetworkStateAsync()
          .then((value) => {
            updateConnection(value);
            if (offlineClient.getSnapshot().online) void reconnect();
          })
          .catch(() => {});
    }, 30_000);
    return () => {
      accountChanged();
      expired();
      changed();
      network.remove();
      active.remove();
      clearInterval(timer);
      if (changeTimer) clearTimeout(changeTimer);
    };
  }, [client]);
  useEffect(() => {
    if (!state.data || state.data.localOnly) return;
    const delay = Math.min(
      2_000_000_000,
      Math.max(0, new Date(state.data.session.expiresAt).getTime() - Date.now())
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
