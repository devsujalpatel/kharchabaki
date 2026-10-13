import { Redirect, Stack } from "expo-router";
import { useAppSession } from "@/lib/session-provider";
import { AppLoading } from "@/components/AppLoading";
import { View } from "react-native";
import { PreferencesProvider, usePreferences } from "@/lib/preferences";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomDock } from "@/components/BottomDock";

export default function DashboardLayout() {
  const { data: session, isPending } = useAppSession();
  if (isPending) return <AppLoading />;
  if (!session) return <Redirect href="/" />; // your login route
  return (
    <PreferencesProvider>
      <DashboardContent avatar={session.user.image} />
    </PreferencesProvider>
  );
}

function DashboardContent({ avatar }: { avatar?: string | null }) {
  const insets = useSafeAreaInsets();
  const { colors } = usePreferences();
  return (
    <View className="flex-1 bg-app-bg" style={{ paddingTop: insets.top }}>
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
