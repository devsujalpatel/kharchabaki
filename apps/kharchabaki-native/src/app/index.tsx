import { AntDesign } from "@expo/vector-icons";
import { Button } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { authClient } from "@/lib/auth-client";

// Sample cash-flow bars for the preview card (oldest -> newest)
const BARS = [38, 52, 44, 60, 48, 66, 58, 74, 62, 82, 70, 92];
const MONTHS = ["Oct", "Jan", "Apr", "Jul", "Sep"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.signIn.social({
        provider: "google",
        // The Expo plugin turns this into a proper deep link for the current
        // environment (dev build, Expo Go, production).
        callbackURL: Linking.createURL("/dashboard", {
          scheme: "kharchabaki",
        }),
      });
      console.log("app callback:", Linking.createURL("/dashboard", { scheme: "kharchabaki" }));
      console.log(
        "google redirect_uri:",
        data?.url ? new URL(data.url).searchParams.get("redirect_uri") : null
      );
      if (error) console.error(error);

      // No router.replace here: once the session is stored, the auth guard in
      // app/_layout.tsx moves the user to /dashboard on its own.
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className="flex-1 bg-[#010200] px-6"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
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
      <View className="gap-4">
        <Button
          size="lg"
          className="bg-[#cbff3d] active:bg-[#cbff3d]/80"
          isDisabled={loading}
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
    </View>
  );
}
