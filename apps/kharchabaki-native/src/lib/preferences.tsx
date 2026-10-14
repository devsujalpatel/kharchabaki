import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Uniwind } from "uniwind";
import { StatusBar } from "expo-status-bar";
import { api } from "@/lib/api";
import { offlineClient } from "@/lib/offline-client";
import { useAppSession } from "@/lib/session-provider";
import { palettes, themes, type Preferences } from "@/lib/finance";

const defaults: Preferences = { currency: "INR", theme: "dark" };
function savedPreferences(value: Record<string, unknown> | null): Preferences | undefined {
  if (
    !value ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    !themes.some((theme) => theme === value.theme)
  )
    return undefined;
  return { currency: value.currency, theme: value.theme as Preferences["theme"] };
}
type SaveOptions = {
  onSuccess?: (preferences: Preferences) => void;
  onError?: (error: Error) => void;
};

async function request(method: string, input?: Partial<Preferences>): Promise<Preferences> {
  const response = await api("/api/v1/preferences", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  if (!response.ok) throw new Error("Could not save or load preferences. Please retry.");
  return (await response.json()).data;
}
function useAccountPreferences() {
  const client = useQueryClient();
  const { data: session } = useAppSession();
  const account = session
    ? `${session.user.id}:${session.localOnly || !session.user.isPremium ? "local" : "cloud"}`
    : undefined;
  const key = useMemo(() => ["preferences", account], [account]);
  const currentAccount = useRef(account);
  const revision = useRef(0);
  const optimistic = useRef<{ account?: string; values: Partial<Preferences> }>({
    account,
    values: {},
  });
  const [draft, setDraft] = useState<{ account?: string; values: Partial<Preferences> }>({
    account,
    values: {},
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  useLayoutEffect(() => {
    currentAccount.current = account;
    revision.current++;
    optimistic.current = { account, values: {} };
    setDraft(optimistic.current);
    setSaving(false);
    setSaveError(null);
    return () => {
      currentAccount.current = undefined;
    };
  }, [account]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => request("GET"),
    enabled: !!account,
    initialData: () => savedPreferences(offlineClient.getCachedPreferences()),
    initialDataUpdatedAt: 0,
  });
  const refetch = query.refetch;
  const save = useCallback(
    (input: Partial<Preferences>, options?: SaveOptions) => {
      if (!account) return;
      const nextRevision = ++revision.current;
      const values = {
        ...(optimistic.current.account === account ? optimistic.current.values : {}),
        ...input,
      };
      optimistic.current = { account, values };
      setDraft(optimistic.current);
      setSaving(true);
      setSaveError(null);
      // Update before waiting for storage or a cloud connection. Subsequent selections stay usable.
      client.setQueryData<Preferences>(key, (previous) => ({
        ...defaults,
        ...previous,
        ...values,
      }));
      void request("PATCH", values)
        .then((data) => {
          if (currentAccount.current !== account || revision.current !== nextRevision) return;
          // A slower response must never replace a newer choice or a different preference field.
          const latest = optimistic.current.account === account ? optimistic.current.values : {};
          const preferences = { ...data, ...latest };
          client.setQueryData(key, preferences);
          setSaving(false);
          setSaveError(null);
          options?.onSuccess?.(preferences);
        })
        .catch((reason: unknown) => {
          if (currentAccount.current !== account || revision.current !== nextRevision) return;
          const error =
            reason instanceof Error
              ? reason
              : new Error("Could not save preferences. Please retry.");
          // Keep the chosen appearance; a failed persistence attempt has an explicit retry.
          setSaving(false);
          setSaveError(error);
          options?.onError?.(error);
        });
    },
    [account, client, key]
  );
  const retry = useCallback(() => {
    if (saveError && optimistic.current.account === account) {
      save(optimistic.current.values);
      return;
    }
    void refetch();
  }, [account, refetch, save, saveError]);
  const preferences = useMemo(
    () => ({ ...defaults, ...query.data, ...(draft.account === account ? draft.values : {}) }),
    [query.data, draft, account]
  );
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(preferences.currency === "INR" ? "en-IN" : "en", {
        style: "currency",
        currency: preferences.currency,
        currencyDisplay: "narrowSymbol",
      }),
    [preferences.currency]
  );
  const formatMoney = useCallback(
    (value: number | string) => formatter.format(Number(value)),
    [formatter]
  );
  const error = saveError ?? query.error;
  return useMemo(
    () => ({
      ...preferences,
      colors: palettes[preferences.theme],
      formatMoney,
      save,
      saving,
      loading: query.isPending,
      saveFailed: !!saveError,
      error,
      retry,
    }),
    [preferences, formatMoney, save, saving, query.isPending, saveError, error, retry]
  );
}
const Context = createContext<ReturnType<typeof useAccountPreferences> | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = useAccountPreferences();
  useLayoutEffect(() => {
    const base = value.theme === "light" || value.theme === "rose" ? "light" : "dark";
    const p = value.colors;
    Uniwind.updateCSSVariables(base, {
      "--app-bg": p.background,
      "--app-card": p.card,
      "--app-text": p.foreground,
      "--app-muted": p.muted,
      "--app-subtle": p.subtle,
      "--app-border": p.border,
      "--app-primary": p.primary,
      "--app-on-primary": p.onPrimary,
      "--background": p.background,
      "--foreground": p.foreground,
      "--surface": p.card,
      "--muted": p.subtle,
      "--border": p.border,
      "--accent": p.primary,
      "--accent-foreground": p.onPrimary,
    });
    Uniwind.setTheme(base);
  }, [value.theme, value.colors]);
  return (
    <Context.Provider value={value}>
      <StatusBar style={value.theme === "light" || value.theme === "rose" ? "dark" : "light"} />
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}
