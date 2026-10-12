import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { focusManager, useQueryClient } from "@tanstack/react-query";
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
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const state = useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot
  );
  const auth = authClient.useSession();
  useEffect(() => {
    const accountChanged = sessionManager.onAccountChange(() => client.clear());
    void Network.getNetworkStateAsync()
      .then((network) => {
        offlineClient.setOnline(
          network.isConnected !== false && network.isInternetReachable !== false
        );
        return sessionManager.bootstrap();
      })
      .catch(() => sessionManager.bootstrap());
    const expired = offlineClient.onUnauthorized(() => {
      void sessionManager.expire();
    });
    const changed = offlineClient.onDataChange(() => {
      void client.invalidateQueries();
    });
    const reconnect = async () => {
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) {
        await offlineClient.flush();
        void client.invalidateQueries();
      }
    };
    const network = Network.addNetworkStateListener((value) => {
      const online = value.isConnected !== false && value.isInternetReachable !== false;
      offlineClient.setOnline(online);
      if (online) void reconnect();
    });
    const active = AppState.addEventListener("change", (value) => {
      focusManager.setFocused(value === "active");
      sessionManager.checkExpiry();
      if (value === "active")
        void Network.getNetworkStateAsync().then((network) => {
          offlineClient.setOnline(
            network.isConnected !== false && network.isInternetReachable !== false
          );
          if (offlineClient.getSnapshot().online) void reconnect();
        });
    });
    const timer = setInterval(() => {
      sessionManager.checkExpiry();
      if (AppState.currentState === "active" && offlineClient.getSnapshot().pending)
        void Network.getNetworkStateAsync().then((network) => {
          offlineClient.setOnline(
            network.isConnected !== false && network.isInternetReachable !== false
          );
          if (offlineClient.getSnapshot().online) void reconnect();
        });
    }, 30_000);
    return () => {
      accountChanged();
      expired();
      changed();
      network.remove();
      active.remove();
      clearInterval(timer);
    };
  }, [client]);
  useEffect(() => {
    if (auth.data?.session.id) {
      void Network.getNetworkStateAsync().then((network) => {
        offlineClient.setOnline(
          network.isConnected !== false && network.isInternetReachable !== false
        );
        void sessionManager.refresh(true);
      });
    }
  }, [auth.data?.session.id]);
  useEffect(() => {
    if (!state.data) return;
    const delay = Math.min(
      2_000_000_000,
      Math.max(0, new Date(state.data.session.expiresAt).getTime() - Date.now())
    );
    const timer = setTimeout(() => sessionManager.checkExpiry(), delay);
    return () => clearTimeout(timer);
  }, [state.data]);
  useEffect(() => {
    const id = state.data?.user.id ?? null;
    if (id)
      void Promise.allSettled(
        [
          "/transactions",
          "/summary",
          "/preferences",
          "/balance",
          "/loans/taken",
          "/loans/given",
        ].map((path) => offlineClient.request(path))
      );
  }, [state.data?.user.id, client]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAppSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
