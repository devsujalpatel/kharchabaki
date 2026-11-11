import { Redirect, Stack, router, usePathname } from "expo-router";
import { useAppSession } from "@/lib/session-provider";
import { AppLoading } from "@/components/AppLoading";
import { Pressable, Text, View } from "react-native";
import { PreferencesProvider, usePreferences } from "@/lib/preferences";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { RecurringProcessor } from "@/components/RecurringProcessor";
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
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = usePreferences();
  return (
    <View className="flex-1 bg-app-bg" style={{ paddingTop: insets.top }}>
      {pathname !== "/dashboard" && (
        <View className="border-b border-app-border px-4 py-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
            className="min-h-11 flex-row items-center gap-1 self-start px-1"
          >
            <ChevronLeft size={18} color={colors.foreground} />
            <Text className="text-sm text-app-text">Back</Text>
          </Pressable>
        </View>
      )}
      <RecurringProcessor />
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
