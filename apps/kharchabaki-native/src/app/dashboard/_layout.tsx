import { Redirect, Stack } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { View } from "react-native";
import { BottomDock } from "@/components/BottomDock";

export default function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  if (!session) return <Redirect href="/" />; // your login route
  return (
    <View className="flex-1 bg-black">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#000",
          },
        }}
      />

      <BottomDock avatar={session.user.image} />
    </View>
  );
}
