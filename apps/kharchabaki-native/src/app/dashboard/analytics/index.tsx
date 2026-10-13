import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { MonthPicker } from "@/components/MonthPicker";
import { MonthlyChart } from "@/components/MonthlyChart";
import { currentMonth, formatLabel } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { dashboardSummaryQuery } from "@/services/dashboard";

const chartColors = ["#16a34a", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#a855f7", "#f97316"];

type BreakdownItem = { label: string; total: string };

export default function Analytics() {
  const [month, setMonth] = useState(currentMonth);
  const { colors } = usePreferences();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });
  const summary = summaryQuery.data?.data;

  return (
    <ScrollView className="flex-1 bg-app-bg" contentContainerClassName="px-4 pb-8 pt-6" showsVerticalScrollIndicator={false}>
      <View className="mb-2">
        <Text className="text-2xl font-semibold text-app-text">Analytics</Text>
        <Text className="mt-1 text-sm text-app-subtle">See where your money comes from and where it goes.</Text>
      </View>
      <MonthPicker month={month} onChange={setMonth} />
      {summaryQuery.isPending ? (
        <View className="rounded-2xl border border-app-border bg-app-card p-8">
          <ActivityIndicator color={colors.primary} />
          <Text className="mt-3 text-center text-sm text-app-subtle">Loading analytics...</Text>
        </View>
      ) : summaryQuery.error ? (
        <View accessibilityRole="alert" className="rounded-2xl border border-red-500/30 bg-app-card p-6">
          <Text className="text-sm text-red-400">{summaryQuery.error.message}</Text>
        </View>
      ) : summary ? (
        <>
          <MonthlyChart daily={summary.daily} monthly={summary.monthly} />
          <Breakdown title="Where expenses go" items={summary.expenseCategories.map((item) => ({ label: item.category, total: item.total }))} total={summary.expense} empty="No expenses recorded for this month." />
          <Breakdown title="Where income comes from" items={summary.incomeSources.map((item) => ({ label: item.source, total: item.total }))} total={summary.income} empty="No income recorded for this month." />
        </>
      ) : null}
    </ScrollView>
  );
}

function Breakdown({ title, items, total, empty }: { title: string; items: BreakdownItem[]; total: string; empty: string }) {
  const { formatMoney, colors } = usePreferences();
  const sorted = [...items].sort((a, b) => Number(b.total) - Number(a.total));
  const sum = sorted.reduce((value, item) => value + Number(item.total), 0);
  const circumference = 2 * Math.PI * 58;
  const slices = sorted.reduce(
    (result, item, index) => {
      const length = sum ? (Number(item.total) / sum) * circumference : 0;
      return {
        offset: result.offset + length,
        slices: [...result.slices, { item, index, length, offset: result.offset }],
      };
    },
    { offset: 0, slices: [] as { item: BreakdownItem; index: number; length: number; offset: number }[] },
  ).slices;

  return (
    <View className="mt-4 rounded-2xl border border-app-border bg-app-card p-5">
      <Text className="text-base font-semibold text-app-text">{title}</Text>
      <Text className="mt-1 text-sm text-app-subtle">Monthly total · {formatMoney(total)}</Text>
      {!sorted.length || !sum ? (
        <Text className="py-10 text-center text-sm text-app-subtle">{empty}</Text>
      ) : (
        <View>
          <View className="my-5 items-center justify-center">
            <Svg width={160} height={160} viewBox="0 0 160 160" accessibilityLabel={`${title} chart`}>
              <Circle cx="80" cy="80" r="58" fill="none" stroke={colors.muted} strokeWidth="26" />
              {slices.map(({ item, index, length, offset: segmentOffset }) => (
                <Circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth="26"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-segmentOffset}
                  rotation="-90"
                  origin="80, 80"
                />
              ))}
            </Svg>
            <View className="absolute items-center">
              <Text className="text-xs text-app-subtle">Total</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit className="mt-1 max-w-28 text-center text-sm font-semibold text-app-text">{formatMoney(total)}</Text>
            </View>
          </View>
          <View className="gap-3">
            {sorted.map((item, index) => (
              <View key={item.label} className="flex-row items-center gap-3">
                <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-app-text">{formatLabel(item.label)}</Text>
                <Text className="w-10 text-right text-sm text-app-subtle">{((Number(item.total) / sum) * 100).toFixed(0)}%</Text>
                <Text className="min-w-24 text-right text-sm font-medium text-app-text">{formatMoney(item.total)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
