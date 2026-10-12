import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect, type JSX } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";

import { SessionProvider, useAppSession } from "@/lib/session-provider";
import { AppLoading } from "@/components/AppLoading";
import "../global.css";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("dark");

function RootNavigator(): JSX.Element | null {
  const { data: session, isPending } = useAppSession();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, [isPending]);

  if (isPending) return <AppLoading />;

  const isLoggedIn = !!session;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="index" />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="dashboard" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </QueryClientProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
