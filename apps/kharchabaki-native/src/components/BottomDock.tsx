import { usePreferences } from "@/lib/preferences";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View, Image } from "react-native";
import { usePathname, router } from "expo-router";
import {
  LayoutGrid,
  Receipt,
  HandCoins,
  UserRound,
  ChartNoAxesCombined,
} from "lucide-react-native";

type BottomDockProps = {
  avatar?: string | null;
};

const tabs = [
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutGrid,
  },
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: Receipt,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: ChartNoAxesCombined,
  },
  {
    label: "Loans",
    href: "/dashboard/loans",
    icon: HandCoins,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: UserRound,
  },
];

export function BottomDock({ avatar }: BottomDockProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const pathname = usePathname();
  const { colors } = usePreferences();

  if (keyboardVisible) return null;
  return (
    <View
      className="border-t border-app-border bg-app-card px-2 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      <View className="flex-row">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);

          const Icon = tab.icon;

          return (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => router.push(tab.href as never)}
              className="flex-1 items-center justify-center"
              style={({ pressed }) => ({
                opacity: pressed ? 0.65 : 1,
              })}
            >
              {/* Icon */}
              {tab.label === "Profile" && isActive && avatar ? (
                <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-app-primary p-0.5">
                  <Image source={{ uri: avatar }} className="h-full w-full rounded-full" />
                </View>
              ) : (
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    isActive ? "bg-app-primary/10" : ""
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    color={isActive ? colors.primary : colors.subtle}
                  />
                </View>
              )}

              {/* Label */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                className={`mt-1 text-[12px] ${
                  isActive ? "font-medium text-app-text" : "text-app-subtle"
                }`}
              >
                {tab.label === "Transactions" ? "History" : tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
