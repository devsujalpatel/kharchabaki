"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
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
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const state = useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot,
  );
  const auth = authClient.useSession();
  useEffect(() => {
    const accountChanged = sessionManager.onAccountChange(() => client.clear());
    offlineClient.setOnline(navigator.onLine);
    void sessionManager.bootstrap();
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
    const changed = offlineClient.onDataChange(() => {
      channel?.postMessage(offlineClient.getAccount());
      void client.invalidateQueries();
    });
    const reconnect = async () => {
      offlineClient.setOnline(true);
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) {
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
    if (auth.data?.session.id) {
      offlineClient.setOnline(navigator.onLine);
      void sessionManager.refresh(true);
    }
  }, [auth.data?.session.id]);
  useEffect(() => {
    if (!state.data) return;
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
        ].map((path) => offlineClient.request(path)),
      );
  }, [state.data?.user.id, client]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAppSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
