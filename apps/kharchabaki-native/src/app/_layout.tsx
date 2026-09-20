import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect, type JSX } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";

import { authClient } from "@/lib/auth-client";
import "../global.css";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("dark");

function RootNavigator(): JSX.Element | null {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync();
  }, [isPending]);

  if (isPending) return null; // splash stays up while the session loads

  const isLoggedIn = !!session;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="index" />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="dashboard" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <RootNavigator />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
