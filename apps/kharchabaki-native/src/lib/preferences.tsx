import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Uniwind } from "uniwind";
import { StatusBar } from "expo-status-bar";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { formatCurrency, palettes, type Preferences } from "@/lib/finance";

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
  const { data: session } = authClient.useSession();
  const key = ["preferences", session?.user.id];
  const query = useQuery({ queryKey: key, queryFn: () => request("GET"), enabled: !!session });
  const mutation = useMutation({
    mutationFn: (input: Partial<Preferences>) => request("PATCH", input),
    onSuccess: (data) => client.setQueryData(key, data),
  });
  const preferences = query.data ?? { currency: "INR", theme: "dark" as const };
  return {
    ...preferences,
    colors: palettes[preferences.theme],
    formatMoney: (value: number | string) => formatCurrency(value, preferences.currency),
    save: mutation.mutate,
    saving: mutation.isPending,
    loading: query.isPending,
    error: mutation.error ?? query.error,
    retry: query.refetch,
  };
}
const Context = createContext<ReturnType<typeof useAccountPreferences> | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = useAccountPreferences();
  useEffect(() => {
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
