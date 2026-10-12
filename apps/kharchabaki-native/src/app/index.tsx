import { AntDesign } from "@expo/vector-icons";
import { Button } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useAppSession, useOfflineStatus } from "@/lib/session-provider";
import * as Network from "expo-network";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { authClient } from "@/lib/auth-client";

// Sample cash-flow bars for the preview card (oldest -> newest)
const BARS = [38, 52, 44, 60, 48, 66, 58, 74, 62, 82, 70, 92];
const MONTHS = ["Oct", "Jan", "Apr", "Jul", "Sep"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const session = useAppSession();
  const offline = useOfflineStatus();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        // The Expo plugin turns this into a proper deep link for the current
        // environment (dev build, Expo Go, production).
        callbackURL: Linking.createURL("/dashboard", {
          scheme: "kharchabaki",
        }),
      });
      if (error) setError(error.message ?? "Could not sign in. Please retry.");
      else await sessionManager.refresh();
    } catch {
      setError("Could not connect to Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#090b09]"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
      }}
    >
      {/* Brand */}
      <View className="flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#cbff3d]">
          <Text className="text-base font-extrabold text-black">₹</Text>
        </View>
        <Text className="text-lg font-semibold tracking-tight text-neutral-100">kharchabaki</Text>
      </View>

      {/* Hero */}
      <View className="flex-1 justify-center gap-3 mt-10">
        <View className="gap-2">
          <Text className="text-3xl font-bold tracking-tight text-neutral-100">
            Spend with clarity.{"\n"}Save with intent.
          </Text>
          <Text className="text-sm leading-6 text-neutral-400">
            Kharchabaki turns your everyday money into a simple, beautiful picture, so every rupee
            has a purpose.
          </Text>
        </View>

        {/* Preview card: the one memorable element on the screen */}
        <View className="rounded-3xl border border-neutral-800 bg-[#070904] p-5">
          <Text className="text-sm text-neutral-500">Total balance</Text>
          <Text className="mt-1 text-3xl font-bold tracking-tight text-neutral-100">
            ₹ 1,24,850.00
          </Text>
          <Text className="mt-1 text-sm font-medium text-[#cbff3d]">▲ 12.6% from last month</Text>

          <View className="mt-6 h-20 flex-row items-end gap-1.5">
            {BARS.map((h, i) => (
              <View
                key={i}
                className={
                  i >= BARS.length - 3
                    ? "flex-1 rounded-t-md bg-[#cbff3d]"
                    : "flex-1 rounded-t-md bg-neutral-800"
                }
                style={{ height: `${h}%` }}
              />
            ))}
          </View>
          <View className="mt-2 flex-row justify-between">
            {MONTHS.map((m) => (
              <Text key={m} className="text-xs text-neutral-600">
                {m}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View className="gap-4 mt-8">
        {session.reason === "expired" && (
          <Text
            accessibilityRole="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            Your session expired. Sign in again; unsynced changes are still saved here.
          </Text>
        )}
        {!offline.online && (
          <Text className="text-center text-sm text-neutral-400">
            Connect to the internet to sign in.
          </Text>
        )}
        {!offline.online && (
          <Pressable
            onPress={() => {
              void Network.getNetworkStateAsync().then((network) => {
                offlineClient.setOnline(
                  network.isConnected !== false && network.isInternetReachable !== false
                );
                return sessionManager.refresh(true);
              });
            }}
          >
            <Text className="text-center text-sm text-[#cbff3d]">Retry connection</Text>
          </Pressable>
        )}
        {error && (
          <Text accessibilityRole="alert" className="text-sm text-red-400">
            {error}
          </Text>
        )}
        <Button
          size="lg"
          className="bg-[#cbff3d] active:bg-[#cbff3d]/80"
          isDisabled={loading || !offline.online}
          onPress={handleLogin}
        >
          <AntDesign name="google" size={18} color="#000" />
          <Text className="text-base font-semibold text-black">
            {loading ? "Opening Google…" : "Continue with Google"}
          </Text>
        </Button>

        <Text className="text-center text-xs text-neutral-400">
          Free forever, no ads, and your data stays yours.
        </Text>
        <Text className="text-center text-xs text-neutral-600">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </ScrollView>
  );
}
