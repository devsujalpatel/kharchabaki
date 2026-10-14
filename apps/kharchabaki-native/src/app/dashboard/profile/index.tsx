import { type JSX, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ChevronRight, Download, LogIn, LogOut, Pencil, Tags, Wallet } from "lucide-react-native";
import { router } from "expo-router";
import { useAppSession, useOfflineStatus } from "@/lib/session-provider";
import { sessionManager } from "@/lib/offline-client";
import { authClient } from "@/lib/auth-client";
import { PreferencesSettings } from "@/components/PreferencesSettings";
import { SyncStatus } from "@/components/SyncStatus";
import { FormSheet } from "@/components/FormSheet";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { usePreferences } from "@/lib/preferences";
import { api } from "@/lib/api";

type BalanceResponse = { success: boolean; message: string; data: { balance: number } };
async function balanceQuery(): Promise<BalanceResponse> {
  const response = await api("/api/v1/balance");
  if (!response.ok) throw new Error("Failed to load balance");
  return response.json();
}
async function addBalance(amount: number): Promise<BalanceResponse> {
  const response = await api("/api/v1/balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to update balance");
  }
  return response.json();
}

export default function Profile(): JSX.Element {
  const queryClient = useQueryClient();
  const offline = useOfflineStatus();
  const { formatMoney, colors } = usePreferences();
  const { data: session, isPending: isUserLoading } = useAppSession();
  const [amount, setAmount] = useState("");
  const [showBalance, setShowBalance] = useState(false);
  const [balanceFormError, setBalanceFormError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const {
    data: balanceData,
    isPending: isBalanceLoading,
    error: balanceError,
  } = useQuery({ queryKey: ["balance"], queryFn: balanceQuery });
  const balanceMutation = useMutation({
    mutationFn: addBalance,
    onSuccess: () => {
      setAmount("");
      setShowBalance(false);
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
  });

  if (isUserLoading)
    return (
      <View
        accessibilityLabel="Loading profile"
        className="flex-1 items-center justify-center bg-app-bg"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (!session?.user)
    return (
      <View className="flex-1 items-center justify-center bg-app-bg px-6">
        <Text className="text-app-text">Please sign in.</Text>
      </View>
    );

  const user = session.user;
  const initials = user.name
    ?.trim()
    .split(/\s+/)
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const canChange = !offline.syncEnabled || (offline.online && offline.pending === 0);
  const validAmount =
    amount.trim().length > 0 && Number.isFinite(Number(amount)) && Number(amount) >= 0;
  const handleBalanceSubmit = () => {
    if (!canChange || balanceMutation.isPending) return;
    if (!validAmount) {
      setBalanceFormError("Enter a valid amount of zero or more.");
      return;
    }
    setBalanceFormError("");
    balanceMutation.mutate(Number(amount));
  };
  const logOut = () => {
    Alert.alert("Log out?", "Your saved changes will stay on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await authClient.signOut();
            await sessionManager.expire(null);
            queryClient.clear();
            router.replace("/");
          } catch {
            setLoggingOut(false);
            Alert.alert("Could not log out", "Please try again.");
          }
        },
      },
    ]);
  };
  const signIn = async () => {
    setLoggingOut(true);
    try {
      await sessionManager.expire(null);
      queryClient.clear();
      router.replace("/");
    } catch {
      setLoggingOut(false);
      Alert.alert("Could not open sign in", "Your local data is still saved. Please retry.");
    }
  };

  return (
    <View className="flex-1 bg-app-bg">
      <KeyboardScreen contentContainerClassName="px-5 pb-8 pt-6">
        <Text className="mb-6 text-3xl font-semibold tracking-tight text-app-text">Profile</Text>
        <View className="flex-row items-center gap-3 rounded-[22px] border border-app-border bg-app-card p-4">
          {user.image ? (
            <Image
              source={{ uri: user.image }}
              accessibilityLabel="Profile photo"
              className="h-14 w-14 rounded-2xl"
            />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-app-muted">
              <Text className="text-lg font-semibold text-app-text">{initials || "?"}</Text>
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-base font-semibold text-app-text"
            >
              {session.localOnly ? "Offline workspace" : user.name}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="middle" className="mt-1 text-xs text-app-subtle">
              {session.localOnly ? "On this device" : user.email}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session.localOnly ? "Sign in" : "Log out"}
            disabled={loggingOut}
            onPress={session.localOnly ? signIn : logOut}
            className={`h-11 w-11 items-center justify-center rounded-xl ${session.localOnly ? "bg-app-muted" : "bg-red-500/10"}`}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#f87171" />
            ) : session.localOnly ? (
              <LogIn size={19} color={colors.primary} />
            ) : (
              <LogOut size={19} color="#f87171" />
            )}
          </Pressable>
        </View>
        <View className="mt-4">
          <SyncStatus />
        </View>
        <View className="mt-5 rounded-[22px] border border-app-border bg-app-card p-5">
          <View className="flex-row items-center gap-2">
            <Wallet size={19} color={colors.primary} />
            <Text className="flex-1 text-sm font-medium text-app-subtle">Balance</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set opening balance"
              disabled={!canChange || isBalanceLoading}
              onPress={() => {
                setAmount("");
                setBalanceFormError("");
                balanceMutation.reset();
                setShowBalance(true);
              }}
              className={`h-11 w-11 items-center justify-center rounded-xl bg-app-muted ${!canChange || isBalanceLoading ? "opacity-40" : ""}`}
            >
              <Pencil size={17} color={colors.foreground} />
            </Pressable>
          </View>
          {isBalanceLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ alignSelf: "flex-start", marginTop: 12 }}
            />
          ) : balanceError ? (
            <Text className="mt-3 text-sm text-red-400">Could not load balance.</Text>
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className="mt-2 text-3xl font-semibold tracking-tight text-app-text"
            >
              {formatMoney(balanceData?.data.balance ?? 0)}
            </Text>
          )}
          {!canChange && (
            <Text className="mt-3 text-xs text-app-subtle">
              Connect and finish syncing to change your opening balance.
            </Text>
          )}
        </View>
        <View className="mt-5 rounded-[22px] border border-app-border bg-app-card p-4">
          <Text className="mb-2 text-sm font-semibold text-app-text">Finance tools</Text>
          {[
            { label: "Budgets", href: "/dashboard/budgets", Icon: Wallet },
            { label: "Recurring entries", href: "/dashboard/recurring", Icon: CalendarClock },
            { label: "Categories & sources", href: "/dashboard/categories", Icon: Tags },
            { label: "Import & export", href: "/dashboard/data-tools", Icon: Download },
          ].map(({ label, href, Icon }) => (
            <Pressable key={href} onPress={() => router.push(href as never)} className="flex-row items-center gap-3 border-t border-app-border py-3">
              <Icon size={17} color={colors.primary} />
              <Text className="flex-1 text-sm text-app-text">{label}</Text>
              <ChevronRight size={17} color={colors.subtle} />
            </Pressable>
          ))}
        </View>
        <PreferencesSettings />
      </KeyboardScreen>
      <FormSheet
        visible={showBalance}
        title="Opening balance"
        onClose={() => setShowBalance(false)}
        disabled={balanceMutation.isPending}
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={!canChange || balanceMutation.isPending || !validAmount}
            onPress={handleBalanceSubmit}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!canChange || balanceMutation.isPending || !validAmount ? "opacity-50" : ""}`}
          >
            {balanceMutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Check size={19} color={colors.onPrimary} />
            )}
            <Text className="font-semibold text-app-on-primary">Save balance</Text>
          </Pressable>
        }
      >
        <Text className="mb-5 text-sm leading-5 text-app-subtle">
          The money you had before tracking transactions. This replaces your opening balance.
        </Text>
        <Text className="mb-2 text-xs font-medium text-app-subtle">Amount</Text>
        <TextInput
          accessibilityLabel="Opening balance amount"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setBalanceFormError("");
          }}
          editable={!balanceMutation.isPending}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.subtle}
          className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-xl font-semibold text-app-text"
        />
        {(balanceFormError || balanceMutation.isError) && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {balanceFormError || balanceMutation.error?.message}
          </Text>
        )}
      </FormSheet>
    </View>
  );
}
