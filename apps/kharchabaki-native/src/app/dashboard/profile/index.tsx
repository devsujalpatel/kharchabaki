import { useAppSession, useOfflineStatus } from "@/lib/session-provider";
import { type JSX, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react-native";
import { router } from "expo-router";

import { sessionManager } from "@/lib/offline-client";
import { authClient } from "@/lib/auth-client";

import { PreferencesSettings } from "@/components/PreferencesSettings";
import { SyncStatus } from "@/components/SyncStatus";
import { usePreferences } from "@/lib/preferences";
import { api } from "@/lib/api";

type BalanceResponse = {
  success: boolean;
  message: string;
  data: {
    balance: number;
  };
};

async function balanceQuery(): Promise<BalanceResponse> {
  const response = await api("/api/v1/balance");

  if (!response.ok) {
    throw new Error("Failed to load balance");
  }

  return response.json();
}

async function addBalance(amount: number): Promise<BalanceResponse> {
  const response = await api("/api/v1/balance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
    }),
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

  const [amount, setAmount] = useState("");

  const { data: session, isPending: isUserLoading } = useAppSession();
  const meData = session ? { data: { session: { user: session.user } } } : null;
  // Balance
  const {
    data: balanceData,
    isPending: isBalanceLoading,
    error: balanceError,
  } = useQuery({
    queryKey: ["balance"],
    queryFn: balanceQuery,
  });

  // Update balance
  const { mutate: updateBalance, isPending: isUpdatingBalance } = useMutation({
    mutationFn: (value: number) => addBalance(value),

    onSuccess: () => {
      setAmount("");

      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });
    },
  });

  if (isUserLoading || isBalanceLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-app-bg">
        <ActivityIndicator size="small" color={colors.primary} />

        <Text className="mt-3 text-sm text-app-subtle">Loading profile...</Text>
      </View>
    );
  }

  if (!meData?.data?.session?.user) {
    return (
      <View className="flex-1 items-center justify-center bg-app-bg px-6">
        <Text className="text-base text-app-text">You are not authenticated.</Text>
      </View>
    );
  }

  const user = meData.data.session.user;

  const initials = user.name
    ?.split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleBalanceSubmit = () => {
    const value = Number(amount);

    if (!amount.trim() || !Number.isFinite(value) || value < 0) {
      return;
    }

    updateBalance(value);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pb-8 pt-6"
      >
        {/* Header */}

        <View className="mb-7">
          <Text className="text-3xl font-semibold tracking-tight text-app-text">Profile</Text>

          <Text className="mt-1 text-sm text-app-subtle">
            Manage your profile and account balance.
          </Text>
        </View>

        <SyncStatus />

        {/* Personal Information */}

        <View className="mt-5 rounded-[22px] border border-app-border bg-app-card">
          <View className="p-5">
            <Text className="text-lg font-medium text-app-text">Personal information</Text>

            <Text className="mt-1 text-sm text-app-subtle">
              Your account information from authentication.
            </Text>

            {/* User */}

            <View className="mt-6 flex-row items-center">
              {user.image ? (
                <Image
                  source={{
                    uri: user.image,
                  }}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-app-muted">
                  <Text className="text-lg font-medium text-app-text">{initials}</Text>
                </View>
              )}

              <View className="ml-4 flex-1">
                <Text className="font-medium text-app-text">{user.name}</Text>

                <Text numberOfLines={1} className="mt-1 text-sm text-app-subtle">
                  {user.email}
                </Text>
              </View>
            </View>

            {/* Separator */}

            <View className="my-6 h-px bg-app-muted" />

            {/* Name */}

            <View>
              <Text className="text-sm text-app-subtle">Name</Text>

              <Text className="mt-1 font-medium text-app-text">{user.name}</Text>
            </View>

            {/* Email */}

            <View className="mt-5">
              <Text className="text-sm text-app-subtle">Email</Text>

              <Text className="mt-1 font-medium text-app-text">{user.email}</Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert("Log out", "Are you sure you want to log out?", [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Log out",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await authClient.signOut();
                        await sessionManager.expire(null);
                        queryClient.clear();

                        router.replace("/");
                      } catch (error) {
                        console.error("Logout failed:", error);

                        Alert.alert("Logout failed", "Something went wrong. Please try again.");
                      }
                    },
                  },
                ]);
              }}
              className="mt-6 h-12 flex-row items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10"
            >
              <LogOut size={18} color="#f87171" />

              <Text className="ml-2 text-sm font-semibold text-red-400">Log out</Text>
            </Pressable>
          </View>
        </View>

        {(!offline.online || offline.pending > 0) && (
          <Text className="mt-5 text-xs text-app-subtle">
            Connect and finish syncing to change your opening balance.
          </Text>
        )}
        {/* Balance */}

        <View className="mt-6 rounded-[22px] border border-app-border bg-app-card">
          <View className="p-5">
            <Text className="text-lg font-medium text-app-text">Balance</Text>

            <Text className="mt-1 text-sm leading-5 text-app-subtle">
              Set the amount you already have before tracking transactions.
            </Text>

            {/* Current balance */}

            <View className="mt-6">
              <Text className="text-sm text-app-subtle">Current balance</Text>

              {balanceError ? (
                <Text className="mt-1 text-sm text-red-400">Failed to load balance.</Text>
              ) : (
                <Text className="mt-1 text-3xl font-semibold tracking-tight text-app-text">
                  {formatMoney(balanceData?.data.balance ?? 0)}
                </Text>
              )}
            </View>

            {/* Separator */}

            <View className="my-6 h-px bg-app-muted" />

            {/* Opening balance */}

            <View>
              <Text className="text-sm font-medium text-app-text">Opening balance</Text>

              <Text className="mt-1 text-xs text-app-subtle">
                This will replace your current opening balance.
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                editable={!isUpdatingBalance}
                keyboardType="decimal-pad"
                placeholder="25000"
                placeholderTextColor="#71717a"
                className="mt-3 h-11 rounded-xl border border-app-border bg-app-bg px-3 text-base text-app-text"
              />

              {/* Update */}

              <Pressable
                disabled={
                  !offline.online ||
                  offline.pending > 0 ||
                  isUpdatingBalance ||
                  !amount ||
                  Number(amount) < 0
                }
                onPress={handleBalanceSubmit}
                className={`mt-3 h-11 items-center justify-center rounded-xl ${
                  isUpdatingBalance || !amount || Number(amount) < 0
                    ? "bg-app-muted"
                    : "bg-app-primary"
                }`}
              >
                {isUpdatingBalance ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color={colors.onPrimary} />

                    <Text className="ml-2 font-medium text-app-on-primary">Updating...</Text>
                  </View>
                ) : (
                  <Text className="font-medium text-app-on-primary">Update balance</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        <PreferencesSettings />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
