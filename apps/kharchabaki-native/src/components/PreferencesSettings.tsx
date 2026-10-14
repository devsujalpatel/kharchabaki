import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Check, ChevronRight, Coins, Palette, RotateCw, Search } from "lucide-react-native";
import { currencies, currencyLabel, themes, palettes, formatLabel } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { FormSheet } from "@/components/FormSheet";

const currencyOptions = currencies.map((code) => ({ code, label: currencyLabel(code) }));

export function PreferencesSettings() {
  const { currency, theme, colors, save, saving, loading, error, retry, saveFailed } =
    usePreferences();
  const [selector, setSelector] = useState<"currency" | "theme" | null>(null);
  const [search, setSearch] = useState("");
  const options = useMemo(
    () =>
      currencyOptions.filter(({ label }) =>
        label.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [search]
  );
  return (
    <View className="mt-5 overflow-hidden rounded-[22px] border border-app-border bg-app-card">
      <View className="flex-row items-center justify-between px-5 pb-2 pt-5">
        <Text className="text-base font-semibold text-app-text">Preferences</Text>
        {(saving || loading) && (
          <ActivityIndicator
            accessibilityLabel={saving ? "Saving preferences" : "Loading preferences"}
            size="small"
            color={colors.primary}
          />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Currency: ${currencyLabel(currency)}. Change currency`}
        onPress={() => {
          setSearch("");
          setSelector("currency");
        }}
        className="flex-row items-center gap-3 px-5 py-4"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-app-muted">
          <Coins size={19} color={colors.primary} />
        </View>
        <Text className="flex-1 text-sm font-medium text-app-text">Currency</Text>
        <Text numberOfLines={1} className="max-w-[40%] text-sm text-app-subtle">
          {currencyLabel(currency)}
        </Text>
        <ChevronRight size={17} color={colors.subtle} />
      </Pressable>
      <View className="mx-5 h-px bg-app-border" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Theme: ${formatLabel(theme)}. Change theme`}
        onPress={() => setSelector("theme")}
        className="flex-row items-center gap-3 px-5 py-4"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-app-muted">
          <Palette size={19} color={colors.primary} />
        </View>
        <Text className="flex-1 text-sm font-medium text-app-text">Theme</Text>
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.background,
            borderColor: colors.primary,
            borderWidth: 3,
          }}
        />
        <Text numberOfLines={1} className="max-w-[35%] text-sm text-app-subtle">
          {formatLabel(theme)}
        </Text>
        <ChevronRight size={17} color={colors.subtle} />
      </Pressable>
      {error && (
        <View className="flex-row items-center gap-3 border-t border-app-border px-5 py-3">
          <Text accessibilityRole="alert" className="flex-1 text-xs leading-5 text-red-400">
            {saveFailed ? "This choice could not be saved. Tap retry." : error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveFailed ? "Retry saving preferences" : "Reload preferences"}
            onPress={() => void retry()}
            className="h-11 w-11 items-center justify-center rounded-xl bg-app-muted"
          >
            <RotateCw size={17} color={colors.foreground} />
          </Pressable>
        </View>
      )}
      <FormSheet
        visible={selector === "currency"}
        title="Currency"
        onClose={() => setSelector(null)}
      >
        <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3">
          <Search size={18} color={colors.subtle} />
          <TextInput
            accessibilityLabel="Find currency"
            value={search}
            onChangeText={setSearch}
            placeholder="Search currency"
            placeholderTextColor={colors.subtle}
            autoCapitalize="characters"
            autoCorrect={false}
            className="h-12 min-w-0 flex-1 text-app-text"
          />
        </View>
        <Text className="mb-4 text-xs leading-5 text-app-subtle">
          Changes the symbol, without converting amounts.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {options.map(({ code, label }) => (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: currency === code }}
              onPress={() => {
                save({ currency: code });
                setSelector(null);
              }}
              className={`min-h-12 w-[48%] flex-row items-center gap-2 rounded-xl border px-3 py-3 ${currency === code ? "border-app-primary bg-app-primary" : "border-app-border bg-app-bg"}`}
            >
              <Text
                numberOfLines={1}
                className={`min-w-0 flex-1 text-sm font-medium ${currency === code ? "text-app-on-primary" : "text-app-text"}`}
              >
                {label}
              </Text>
              {currency === code && <Check size={16} color={colors.onPrimary} />}
            </Pressable>
          ))}
        </View>
        {options.length === 0 && (
          <Text className="py-5 text-center text-sm text-app-subtle">No currencies found</Text>
        )}
        {error && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {error.message}
          </Text>
        )}
      </FormSheet>
      <FormSheet visible={selector === "theme"} title="Theme" onClose={() => setSelector(null)}>
        <View className="flex-row flex-wrap gap-3">
          {themes.map((option) => {
            const p = palettes[option];
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={`${formatLabel(option)} theme`}
                accessibilityState={{ selected: theme === option }}
                onPress={() => {
                  save({ theme: option });
                  setSelector(null);
                }}
                className={`w-[47%] overflow-hidden rounded-2xl border p-3 ${theme === option ? "border-app-primary" : "border-app-border"}`}
              >
                <View
                  style={{
                    backgroundColor: p.background,
                    height: 76,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: p.card,
                      borderColor: p.border,
                      borderWidth: 1,
                      borderRadius: 7,
                      padding: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: p.foreground,
                        height: 4,
                        width: "50%",
                        borderRadius: 2,
                      }}
                    />
                    <View
                      style={{
                        backgroundColor: p.muted,
                        height: 4,
                        width: "75%",
                        borderRadius: 2,
                        marginTop: 5,
                      }}
                    />
                    <View
                      style={{
                        backgroundColor: p.primary,
                        height: 10,
                        width: "35%",
                        borderRadius: 4,
                        marginTop: 7,
                      }}
                    />
                  </View>
                </View>
                <View className="mt-3 flex-row items-center justify-between gap-2">
                  <Text
                    numberOfLines={1}
                    className="min-w-0 flex-1 text-sm font-medium text-app-text"
                  >
                    {formatLabel(option)}
                  </Text>
                  {theme === option && <Check size={17} color={colors.primary} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {error && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {error.message}
          </Text>
        )}
      </FormSheet>
    </View>
  );
}
