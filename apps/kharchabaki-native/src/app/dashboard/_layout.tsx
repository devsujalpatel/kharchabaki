import { Redirect, Stack } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { View } from "react-native";
import { PreferencesProvider, usePreferences } from "@/lib/preferences";
import { BottomDock } from "@/components/BottomDock";

export default function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  if (!session) return <Redirect href="/" />; // your login route
  return (
    <PreferencesProvider>
      <DashboardContent avatar={session.user.image} />
    </PreferencesProvider>
  );
}

function DashboardContent({ avatar }: { avatar?: string | null }) {
  const { colors } = usePreferences();
  return (
    <View className="flex-1 bg-app-bg">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      />

      <BottomDock avatar={avatar} />
    </View>
  );
}
