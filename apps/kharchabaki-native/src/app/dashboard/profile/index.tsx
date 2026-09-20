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
import { authClient } from "@/lib/auth-client";

import { api } from "@/lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type MeResponse = {
  success: boolean;
  data: {
    session: {
      user: User;
    };
  };
};

type BalanceResponse = {
  success: boolean;
  message: string;
  data: {
    balance: number;
  };
};

async function getMe(): Promise<MeResponse> {
  const response = await api("/api/v1/me");

  if (!response.ok) {
    throw new Error("Failed to load profile");
  }

  return response.json();
}

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

  const [amount, setAmount] = useState("");

  // User
  const {
    data: meData,
    isPending: isUserLoading,
    error: userError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

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

      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });
    },
  });

  if (isUserLoading || isBalanceLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="small" color="#ffffff" />

        <Text className="mt-3 text-sm text-zinc-500">Loading profile...</Text>
      </View>
    );
  }

  if (userError || !meData?.data?.session?.user) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="text-base text-white">You are not authenticated.</Text>
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

    if (!value || value < 0) {
      return;
    }

    updateBalance(value);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pb-32 pt-6"
      >
        {/* Header */}

        <View className="mb-7">
          <Text className="text-3xl font-semibold tracking-tight text-white">Profile</Text>

          <Text className="mt-1 text-sm text-zinc-500">
            Manage your profile and account balance.
          </Text>
        </View>

        {/* Personal Information */}

        <View className="rounded-[22px] border border-zinc-900 bg-[#050604]">
          <View className="p-5">
            <Text className="text-lg font-medium text-white">Personal information</Text>

            <Text className="mt-1 text-sm text-zinc-500">
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
                <View className="h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
                  <Text className="text-lg font-medium text-white">{initials}</Text>
                </View>
              )}

              <View className="ml-4 flex-1">
                <Text className="font-medium text-white">{user.name}</Text>

                <Text numberOfLines={1} className="mt-1 text-sm text-zinc-500">
                  {user.email}
                </Text>
              </View>
            </View>

            {/* Separator */}

            <View className="my-6 h-px bg-zinc-900" />

            {/* Name */}

            <View>
              <Text className="text-sm text-zinc-500">Name</Text>

              <Text className="mt-1 font-medium text-white">{user.name}</Text>
            </View>

            {/* Email */}

            <View className="mt-5">
              <Text className="text-sm text-zinc-500">Email</Text>

              <Text className="mt-1 font-medium text-white">{user.email}</Text>
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

        {/* Balance */}

        <View className="mt-6 rounded-[22px] border border-zinc-900 bg-[#050604]">
          <View className="p-5">
            <Text className="text-lg font-medium text-white">Balance</Text>

            <Text className="mt-1 text-sm leading-5 text-zinc-500">
              Set the amount you already have before tracking transactions.
            </Text>

            {/* Current balance */}

            <View className="mt-6">
              <Text className="text-sm text-zinc-500">Current balance</Text>

              {balanceError ? (
                <Text className="mt-1 text-sm text-red-400">Failed to load balance.</Text>
              ) : (
                <Text className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  ₹{balanceData?.data.balance.toLocaleString("en-IN")}
                </Text>
              )}
            </View>

            {/* Separator */}

            <View className="my-6 h-px bg-zinc-900" />

            {/* Opening balance */}

            <View>
              <Text className="text-sm font-medium text-white">Opening balance</Text>

              <Text className="mt-1 text-xs text-zinc-500">
                This will replace your current opening balance.
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                editable={!isUpdatingBalance}
                keyboardType="decimal-pad"
                placeholder="25000"
                placeholderTextColor="#71717a"
                className="mt-3 h-11 rounded-xl border border-zinc-800 bg-[#0c0e09] px-3 text-base text-white"
              />

              {/* Update */}

              <Pressable
                disabled={isUpdatingBalance || !amount || Number(amount) < 0}
                onPress={handleBalanceSubmit}
                className={`mt-3 h-11 items-center justify-center rounded-xl ${
                  isUpdatingBalance || !amount || Number(amount) < 0 ? "bg-lime-900" : "bg-lime-600"
                }`}
              >
                {isUpdatingBalance ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#000" />

                    <Text className="ml-2 font-medium text-black">Updating...</Text>
                  </View>
                ) : (
                  <Text className="font-medium text-black">Update balance</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
