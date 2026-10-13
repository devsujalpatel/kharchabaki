import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
} from "lucide-react-native";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { FormSheet } from "@/components/FormSheet";

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2026, index, 1).toLocaleDateString(undefined, { month: "short" })
);

export function MonthPicker({
  month,
  onChange,
  allowAll = false,
}: {
  month: string;
  onChange: (month: string) => void;
  allowAll?: boolean;
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number((month || currentMonth()).slice(0, 4)));
  const selected = month || currentMonth();
  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }
  return (
    <View className="my-4">
      <View className="flex-row items-center rounded-2xl border border-app-border bg-app-card p-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => onChange(shiftMonth(selected, -1))}
          className="h-11 w-11 items-center justify-center rounded-xl"
        >
          <ChevronLeft color={colors.subtle} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose month: ${month ? monthLabel(month) : "All history"}`}
          onPress={() => {
            setYear(Number(selected.slice(0, 4)));
            setOpen(true);
          }}
          className="min-h-11 min-w-0 flex-1 flex-row items-center justify-center gap-2 px-1"
        >
          <CalendarDays size={17} color={colors.primary} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            className="min-w-0 shrink text-sm font-semibold text-app-text"
          >
            {month ? monthLabel(month) : "All history"}
          </Text>
          <ChevronDown color={colors.subtle} size={14} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => onChange(shiftMonth(selected, 1))}
          className="h-11 w-11 items-center justify-center rounded-xl"
        >
          <ChevronRight color={colors.subtle} size={20} />
        </Pressable>
      </View>
      <FormSheet visible={open} title="Choose month" onClose={() => setOpen(false)}>
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            disabled={year <= 1900}
            onPress={() => setYear(year - 1)}
            className="h-11 w-11 items-center justify-center rounded-xl bg-app-muted"
          >
            <ChevronLeft size={20} color={colors.subtle} />
          </Pressable>
          <Text className="text-lg font-semibold text-app-text">{year}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next year"
            disabled={year >= 9999}
            onPress={() => setYear(year + 1)}
            className="h-11 w-11 items-center justify-center rounded-xl bg-app-muted"
          >
            <ChevronRight size={20} color={colors.subtle} />
          </Pressable>
        </View>
        <View className="flex-row flex-wrap">
          {monthNames.map((name, index) => {
            const value = `${year}-${String(index + 1).padStart(2, "0")}`;
            const active = value === month;
            return (
              <View key={name} className="w-1/3 p-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name} ${year}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => choose(value)}
                  className={`h-12 items-center justify-center rounded-2xl ${active ? "bg-app-primary" : "bg-app-muted"}`}
                >
                  <Text
                    className={`text-sm font-semibold ${active ? "text-app-on-primary" : "text-app-text"}`}
                  >
                    {name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View className="mt-4 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(currentMonth())}
            className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-app-border px-2"
          >
            <RotateCcw size={17} color={colors.primary} />
            <Text numberOfLines={1} className="text-sm font-medium text-app-text">
              This month
            </Text>
          </Pressable>
          {allowAll && (
            <Pressable
              accessibilityRole="button"
              onPress={() => choose("")}
              className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-app-border px-2 ${!month ? "bg-app-primary/10" : ""}`}
            >
              <History size={17} color={colors.primary} />
              <Text numberOfLines={1} className="text-sm font-medium text-app-text">
                All history
              </Text>
            </Pressable>
          )}
        </View>
      </FormSheet>
    </View>
  );
}
