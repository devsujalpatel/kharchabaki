"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthPicker } from "@/components/month-picker";
import { MonthlyChart } from "@/components/monthly-chart";
import { usePreferences } from "@/components/providers/preferences-provider";
import { currentMonth, formatLabel } from "@/lib/finance";
import { dashboardSummaryQuery } from "@/server/summary";

const chartColors = ["#15803d", "#dc2626", "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#9333ea", "#ea580c"];

type BreakdownItem = { label: string; total: string };

export default function AnalyticsPage() {
  const [month, setMonth] = useState(currentMonth);
  const { formatMoney } = usePreferences();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });
  const summary = summaryQuery.data?.data;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">See where your money comes from and where it goes.</p>
      </div>
      <MonthPicker month={month} onChange={setMonth} />
      {summaryQuery.isPending ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading analytics…</p>
      ) : summaryQuery.error ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
          {summaryQuery.error.message}
        </div>
      ) : summary ? (
        <>
          <MonthlyChart daily={summary.daily} monthly={summary.monthly} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Breakdown
              title="Where expenses go"
              items={summary.expenseCategories.map((item) => ({ label: item.category, total: item.total }))}
              total={summary.expense}
              formatMoney={formatMoney}
              empty="No expenses recorded for this month."
            />
            <Breakdown
              title="Where income comes from"
              items={summary.incomeSources.map((item) => ({ label: item.source, total: item.total }))}
              total={summary.income}
              formatMoney={formatMoney}
              empty="No income recorded for this month."
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  items,
  total,
  formatMoney,
  empty,
}: {
  title: string;
  items: BreakdownItem[];
  total: string;
  formatMoney: (value: number | string) => string;
  empty: string;
}) {
  const sorted = [...items].sort((a, b) => Number(b.total) - Number(a.total));
  const sum = sorted.reduce((value, item) => value + Number(item.total), 0);
  const gradient = sorted.reduce(
    (result, item, index) => {
      const end = result.offset + (sum ? (Number(item.total) / sum) * 100 : 0);
      return {
        offset: end,
        slices: [...result.slices, `${chartColors[index % chartColors.length]} ${result.offset}% ${end}%`],
      };
    },
    { offset: 0, slices: [] as string[] },
  ).slices.join(", ");

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">Monthly total · {formatMoney(total)}</p>
      </CardHeader>
      <CardContent>
        {!sorted.length || !sum ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(150px,0.8fr)_1.2fr]">
            <div
              className="mx-auto aspect-square w-40 rounded-full"
              role="img"
              aria-label={`${title}: ${sorted.map((item) => `${formatLabel(item.label)} ${formatMoney(item.total)}`).join(", ")}`}
              style={{ background: `conic-gradient(${gradient})` }}
            />
            <ul className="space-y-3">
              {sorted.map((item, index) => {
                const percentage = (Number(item.total) / sum) * 100;
                return (
                  <li key={item.label} className="flex items-center gap-3 text-sm">
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    <span className="min-w-0 flex-1 truncate">{formatLabel(item.label)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{percentage.toFixed(0)}%</span>
                    <span className="min-w-24 text-right font-medium tabular-nums">{formatMoney(item.total)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
