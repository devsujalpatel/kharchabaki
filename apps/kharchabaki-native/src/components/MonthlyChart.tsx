import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { type DailyTotal } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";

export function MonthlyChart({ daily, monthly }: { daily: DailyTotal[]; monthly: DailyTotal[] }) {
  const { formatMoney } = usePreferences();
  const [view, setView] = useState<"daily" | "monthly">("monthly");
  const series = view === "monthly" ? monthly : daily;
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...series.flatMap((day) => [Number(day.income), Number(day.expense)]));
  const point = series.find((day) => day.date === selected);
  return (
    <View className="my-5 rounded-2xl border border-app-border bg-app-card p-5">
      <Text className="text-base font-semibold text-app-text">Cash flow</Text>
      <View className="mt-3 flex-row gap-3">
        {(["monthly", "daily"] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => {
              setView(option);
              setSelected(null);
            }}
            className={`rounded-xl px-3 py-2 ${view === option ? "bg-app-primary" : "bg-app-muted"}`}
          >
            <Text className={view === option ? "text-app-on-primary" : "text-app-text"}>
              {option === "monthly" ? "6 months" : "By day"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="my-3 flex-row gap-4">
        <Text className="text-sm text-emerald-500">● Income</Text>
        <Text className="text-sm text-red-400">● Expenses</Text>
      </View>
      {!series.some((day) => Number(day.income) || Number(day.expense)) && (
        <Text className="mb-3 text-sm text-app-subtle">No income or expenses for this period.</Text>
      )}
      <Text className="mb-2 text-xs text-app-subtle">
        Scale: {formatMoney(max)} · Tap a bar for amounts
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {series.map((day) => (
            <Pressable
              key={day.date}
              accessibilityLabel={`${day.date}: income ${formatMoney(day.income)}, expenses ${formatMoney(day.expense)}`}
              onPress={() => setSelected(day.date)}
              className={view === "monthly" ? "w-12" : "w-7"}
            >
              <View className="h-32 flex-row items-end justify-center gap-1 border-b border-app-border">
                <View
                  style={{
                    height: Number(day.income) ? Math.max(2, (Number(day.income) / max) * 120) : 0,
                  }}
                  className="w-2 rounded-t bg-emerald-500"
                />
                <View
                  style={{
                    height: Number(day.expense)
                      ? Math.max(2, (Number(day.expense) / max) * 120)
                      : 0,
                  }}
                  className="w-2 rounded-t bg-red-400"
                />
              </View>
              <Text className="mt-2 text-center text-xs text-app-subtle">
                {view === "monthly"
                  ? new Date(`${day.date}-01T00:00:00Z`).toLocaleDateString("en", {
                      month: "short",
                      timeZone: "UTC",
                    })
                  : Number(day.date.slice(-2))}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {point && (
        <Text className="mt-4 text-sm text-app-text">
          {point.date}: +{formatMoney(point.income)} / −{formatMoney(point.expense)}
        </Text>
      )}
    </View>
  );
}
