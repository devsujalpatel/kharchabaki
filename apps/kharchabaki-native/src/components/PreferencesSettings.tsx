import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { currencies, currencyLabel, themes, palettes, formatLabel } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
export function PreferencesSettings() {
  const { currency, theme, colors, save, saving, loading, error, retry } = usePreferences();
  const [search, setSearch] = useState("");
  const options = currencies.filter((code) =>
    currencyLabel(code).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <View className="mt-6 rounded-2xl border border-app-border bg-app-card p-5">
      <Text className="text-lg font-semibold text-app-text">Preferences</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text className="mb-2 mt-4 font-medium text-app-text">
            Default currency · {currencyLabel(currency)}
          </Text>
          <Text className="mb-3 text-xs text-app-subtle">
            Applies to all amounts. Changing currency does not convert existing values.
          </Text>
          <TextInput
            accessibilityLabel="Find currency"
            value={search}
            onChangeText={setSearch}
            placeholder="Find currency (USD, GBP, JPY...)"
            placeholderTextColor={colors.subtle}
            className="mb-3 h-11 rounded-xl border border-app-border px-3 text-app-text"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {options.map((code) => (
                <Pressable
                  key={code}
                  disabled={saving}
                  onPress={() => save({ currency: code })}
                  className={`rounded-xl border p-3 ${currency === code ? "border-app-primary bg-app-primary" : "border-app-border"}`}
                >
                  <Text className={currency === code ? "text-app-on-primary" : "text-app-text"}>
                    {currencyLabel(code)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text className="mb-3 mt-5 font-medium text-app-text">Theme</Text>
          <View className="flex-row flex-wrap gap-3">
            {themes.map((option) => (
              <Pressable
                key={option}
                disabled={saving}
                onPress={() => save({ theme: option })}
                accessibilityState={{ selected: theme === option }}
                className={`flex-row items-center gap-2 rounded-xl border p-3 ${theme === option ? "border-app-primary" : "border-app-border"}`}
              >
                <View
                  style={{
                    backgroundColor: palettes[option].background,
                    borderColor: palettes[option].primary,
                    borderWidth: 3,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                  }}
                />
                <Text className="text-app-text">
                  {formatLabel(option)}
                  {theme === option ? " ✓" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {saving && <Text className="mt-3 text-app-subtle">Saving preferences...</Text>}
      {error && (
        <View className="mt-3">
          <Text accessibilityRole="alert" className="text-red-400">
            {error.message}
          </Text>
          <Pressable onPress={() => retry()}>
            <Text className="mt-2 text-app-text">Reload preferences</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
