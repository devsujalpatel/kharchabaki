import { createElement, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, Search, Shapes } from "lucide-react-native";
import { categoryIcon, formatLabel } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { FormSheet, useSheetPanel } from "@/components/FormSheet";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label: string;
  disabled?: boolean;
  includeAll?: boolean;
};
export function CategoryPicker({ value, onChange, options, label, disabled, includeAll }: Props) {
  const { colors } = usePreferences();
  const showPanel = useSheetPanel();
  const [open, setOpen] = useState(false);
  const selected = value && value !== "all";
  const Icon = selected ? categoryIcon(value) : Shapes;
  function choose(next: string) {
    onChange(next);
    if (showPanel) showPanel(null);
    else setOpen(false);
  }
  function show() {
    if (showPanel)
      showPanel({
        title: label,
        content: (
          <CategoryOptions
            value={value}
            options={options}
            onChange={choose}
            includeAll={includeAll}
          />
        ),
      });
    else setOpen(true);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? formatLabel(value) : includeAll ? "All" : "Choose"}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={show}
        className="h-12 flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-bg px-3"
      >
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-app-muted">
          {createElement(Icon, { size: 17, color: selected ? colors.primary : colors.subtle })}
        </View>
        <Text
          numberOfLines={1}
          className={`min-w-0 flex-1 text-sm ${selected ? "text-app-text" : "text-app-subtle"}`}
        >
          {selected
            ? formatLabel(value)
            : includeAll
              ? "All categories"
              : `Choose ${label.toLowerCase()}`}
        </Text>
        <ChevronDown size={16} color={colors.subtle} />
      </Pressable>
      {!showPanel && (
        <FormSheet visible={open} title={label} onClose={() => setOpen(false)}>
          <CategoryOptions
            value={value}
            options={options}
            onChange={choose}
            includeAll={includeAll}
          />
        </FormSheet>
      )}
    </>
  );
}
function CategoryOptions({
  value,
  onChange,
  options,
  includeAll,
}: Omit<Props, "label" | "disabled">) {
  const { colors } = usePreferences();
  const [search, setSearch] = useState("");
  const choices = [...new Set([...(includeAll ? ["all"] : []), ...options])].filter((option) =>
    formatLabel(option).toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <View>
      <View className="mb-3 h-12 flex-row items-center gap-2 rounded-2xl border border-app-border bg-app-bg px-3">
        <Search size={18} color={colors.subtle} />
        <TextInput
          accessibilityLabel="Search categories"
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={colors.subtle}
          className="min-w-0 flex-1 text-base text-app-text"
          autoCorrect={false}
        />
      </View>
      {choices.map((option) => {
        const Icon = option === "all" ? Shapes : categoryIcon(option);
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option === "all" ? "All categories" : formatLabel(option)}
            onPress={() => onChange(option)}
            className={`mb-1 min-h-14 flex-row items-center gap-3 rounded-2xl px-3 py-2 ${selected ? "bg-app-primary/10" : ""}`}
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-app-muted">
              <Icon size={19} color={selected ? colors.primary : colors.subtle} />
            </View>
            <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium text-app-text">
              {option === "all" ? "All categories" : formatLabel(option)}
            </Text>
            {selected && <Check size={18} color={colors.primary} />}
          </Pressable>
        );
      })}
      {!choices.length && (
        <Text className="py-8 text-center text-sm text-app-subtle">No matches</Text>
      )}
    </View>
  );
}
