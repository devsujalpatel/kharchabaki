import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { usePreferences } from "@/lib/preferences";
export function DateField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const [year, month, day] = value.split("-").map(Number);
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm font-medium text-app-text">Date</Text>
      <Pressable
        accessibilityLabel="Transaction date"
        disabled={disabled}
        onPress={() => setOpen(true)}
        className="rounded-xl border border-app-border bg-app-bg p-3"
      >
        <Text style={{ color: colors.foreground }}>{value}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={new Date(year, month - 1, day)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === "set" && selected)
              onChange(
                `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`
              );
          }}
        />
      )}
    </View>
  );
}
