import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { CalendarDays, Check, ChevronDown } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { usePreferences } from "@/lib/preferences";

export function DateField({
  value,
  onChange,
  disabled,
  label = "Date",
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  const displayDate = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-medium text-app-text">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayDate}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        className="h-12 flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-bg px-3"
      >
        <CalendarDays size={19} color={colors.subtle} />
        <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-app-text">
          {displayDate}
        </Text>
        <ChevronDown size={16} color={colors.subtle} />
      </Pressable>
      {open && (
        <View className="mt-2 overflow-hidden rounded-2xl bg-app-bg">
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            textColor={colors.foreground}
            accentColor={colors.primary}
            onChange={(event, selected) => {
              if (Platform.OS !== "ios") setOpen(false);
              if (event.type === "set" && selected)
                onChange(
                  `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`
                );
            }}
          />
          {Platform.OS === "ios" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm date"
              onPress={() => setOpen(false)}
              className="min-h-11 flex-row items-center justify-center gap-2 border-t border-app-border"
            >
              <Check size={18} color={colors.primary} />
              <Text className="text-sm font-semibold text-app-primary">Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
