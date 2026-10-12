import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";

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
  const [jump, setJump] = useState<string | null>(null);
  const selected = month || currentMonth();
  return (
    <View className="my-4 gap-3">
      <View className="flex-row items-center justify-between rounded-xl border border-app-border bg-app-card p-2">
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => onChange(shiftMonth(selected, -1))}
          className="p-2"
        >
          <ChevronLeft color={colors.foreground} size={20} />
        </Pressable>
        <Pressable onPress={() => setJump(selected)} className="p-2">
          <Text className="font-semibold text-app-text">
            {month ? monthLabel(month) : "All months"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => onChange(shiftMonth(selected, 1))}
          className="p-2"
        >
          <ChevronRight color={colors.foreground} size={20} />
        </Pressable>
      </View>
      {jump !== null && (
        <View className="flex-row items-center gap-3">
          <TextInput
            accessibilityLabel="Jump to month, YYYY-MM"
            placeholder="YYYY-MM"
            placeholderTextColor={colors.subtle}
            value={jump}
            onChangeText={setJump}
            className="h-11 flex-1 rounded-xl border border-app-border px-3 text-app-text"
          />
          <Pressable
            disabled={!/^\d{4}-(0[1-9]|1[0-2])$/.test(jump) || Number(jump.slice(0, 4)) < 1900}
            onPress={() => {
              onChange(jump);
              setJump(null);
            }}
            className="rounded-xl bg-app-primary px-4 py-3"
          >
            <Text className="text-app-on-primary">Go</Text>
          </Pressable>
          <Pressable onPress={() => setJump(null)}>
            <Text className="text-app-subtle">Cancel</Text>
          </Pressable>
        </View>
      )}
      <View className="flex-row gap-4">
        <Pressable onPress={() => onChange(currentMonth())}>
          <Text className="text-sm text-app-subtle">This month</Text>
        </Pressable>
        {allowAll && (
          <Pressable onPress={() => onChange("")}>
            <Text className="text-sm text-app-subtle">All history</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
