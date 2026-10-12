import { usePreferences } from "@/lib/preferences";
import { Pressable, Text, View, Image } from "react-native";
import { usePathname, router } from "expo-router";
import { LayoutGrid, Receipt, HandCoins, UserRound } from "lucide-react-native";

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
  const pathname = usePathname();
  const { colors } = usePreferences();

  return (
    <View className="border-t border-app-border bg-app-bg px-2 pb-2 pt-2">
      <View className="flex-row">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);

          const Icon = tab.icon;

          return (
            <Pressable
              key={tab.href}
              onPress={() => router.push(tab.href as never)}
              className="flex-1 items-center justify-center"
              style={({ pressed }) => ({
                opacity: pressed ? 0.65 : 1,
              })}
            >
              {/* Icon */}
              {tab.label === "Profile" && isActive && avatar ? (
                <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-white p-0.5">
                  <Image source={{ uri: avatar }} className="h-full w-full rounded-full" />
                </View>
              ) : (
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    isActive ? "bg-app-muted" : ""
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
                className={`mt-1 text-[12px] ${
                  isActive ? "font-medium text-app-text" : "text-app-subtle"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
