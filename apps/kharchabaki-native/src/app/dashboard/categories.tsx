import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { usePreferences } from "@/lib/preferences";
import { getLabels, saveLabel, updateLabel } from "@/lib/finance-features";
import { expenseCategories, incomeSources, formatLabel } from "@/lib/finance";
export default function CategoriesScreen() {
  const client = useQueryClient(); const { colors } = usePreferences(); const [kind, setKind] = useState<"expense" | "income">("expense"); const [name, setName] = useState("");
  const query = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const save = useMutation({ mutationFn: () => saveLabel({ kind, name: name.trim(), key: name.trim().toLowerCase().replace(/\s+/g, "-") }), onSuccess: () => { setName(""); void client.invalidateQueries({ queryKey: ["finance-labels"] }); } });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => updateLabel(id, { active }), onSuccess: () => void client.invalidateQueries({ queryKey: ["finance-labels"] }) });
  const labels = query.data?.data ?? []; const builtins = kind === "expense" ? expenseCategories : incomeSources;
  return <ScrollView className="flex-1 bg-app-bg" contentContainerClassName="px-5 pb-8 pt-6"><Text className="text-3xl font-semibold text-app-text">Categories & sources</Text><Text className="mt-1 text-sm text-app-subtle">Add labels to personalize transaction tracking.</Text>
    <View className="my-5 flex-row gap-2">{(["expense", "income"] as const).map((value) => <Pressable key={value} onPress={() => setKind(value)} className={`flex-1 rounded-xl p-3 ${kind === value ? "bg-app-primary" : "bg-app-muted"}`}><Text className="text-center text-xs text-app-text">{value === "expense" ? "Expenses" : "Income"}</Text></Pressable>)}</View>
    <View className="flex-row gap-2"><TextInput accessibilityLabel="New custom label" value={name} onChangeText={setName} maxLength={60} placeholder={kind === "expense" ? "Pet care" : "Side project"} placeholderTextColor={colors.subtle} className="h-12 flex-1 rounded-xl border border-app-border bg-app-card px-3 text-app-text"/><Pressable accessibilityRole="button" onPress={() => save.mutate()} disabled={!name.trim() || save.isPending} className="h-12 w-12 items-center justify-center rounded-xl bg-app-primary"><Plus size={20} color={colors.onPrimary}/></Pressable></View>{save.error && <Text accessibilityRole="alert" className="mt-2 text-sm text-red-400">{save.error.message}</Text>}
    <Text className="mb-2 mt-6 text-sm font-semibold text-app-text">Built in</Text><View className="flex-row flex-wrap gap-2">{builtins.map((item) => <View key={item} className="rounded-full bg-app-card px-3 py-2"><Text className="text-xs text-app-subtle">{formatLabel(item)}</Text></View>)}</View>
    <Text className="mb-2 mt-6 text-sm font-semibold text-app-text">Custom</Text>{query.isPending ? <ActivityIndicator color={colors.primary}/> : labels.filter((item) => item.kind === kind).map((item) => <View key={item.id} className="mb-2 flex-row items-center rounded-xl bg-app-card p-3"><Text className="flex-1 text-sm text-app-text">{item.name}</Text><Pressable onPress={() => toggle.mutate({ id: item.id, active: !item.active })}><Text className="text-xs text-app-primary">{item.active ? "Disable" : "Enable"}</Text></Pressable></View>)}
  </ScrollView>;
}
