"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { formatCurrency, type Preferences } from "@/lib/finance";

type Response = { data: Preferences };
function useAccountPreferences() {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const { setTheme } = useTheme();
  const key = ["preferences", session?.user.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<Response>("/preferences"),
    enabled: !!session,
  });
  const mutation = useMutation({
    mutationFn: (input: Partial<Preferences>) =>
      api<Response>("/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => client.setQueryData(key, data),
  });
  const preferences = query.data?.data ?? {
    currency: "INR",
    theme: "dark" as const,
  };
  useEffect(() => {
    if (query.data) setTheme(query.data.data.theme);
  }, [query.data, setTheme]);
  return {
    ...preferences,
    formatMoney: (value: number | string) =>
      formatCurrency(value, preferences.currency),
    save: mutation.mutate,
    saving: mutation.isPending,
    loading: query.isPending,
    error: mutation.error ?? query.error,
    retry: query.refetch,
  };
}
const Context = createContext<ReturnType<typeof useAccountPreferences> | null>(
  null,
);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = useAccountPreferences();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}
