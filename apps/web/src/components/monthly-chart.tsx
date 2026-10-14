"use client";
import { useState } from "react";
import type { DailyTotal } from "@/lib/finance";
import { usePreferences } from "@/components/providers/preferences-provider";
export function MonthlyChart({
  daily,
  monthly,
}: {
  daily: DailyTotal[];
  monthly: DailyTotal[];
}) {
  const { formatMoney } = usePreferences();
  const [view, setView] = useState<"daily" | "monthly">("monthly");
  const series = view === "monthly" ? monthly : daily;
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(
    1,
    ...series.flatMap((day) => [Number(day.income), Number(day.expense)]),
  );
  const point = series.find((day) => day.date === selected);
  return (
    <section
      className="rounded-2xl border bg-card p-5"
      aria-label="Daily income and expenses for selected month"
    >
      <h2 className="font-semibold">Cash flow</h2>
      <div className="mt-3 flex gap-2">
        {(["monthly", "daily"] as const).map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={view === option}
            onClick={() => {
              setView(option);
              setSelected(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm ${view === option ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {option === "monthly" ? "6 months" : "By day"}
          </button>
        ))}
      </div>
      <div className="my-3 flex gap-4 text-sm">
        <span className="text-income">● Income</span>
        <span className="text-expense">● Expenses</span>
      </div>
      {!series.some((day) => Number(day.income) || Number(day.expense)) && (
        <p className="mb-3 text-sm text-muted-foreground">
          No income or expenses for this period.
        </p>
      )}
      <p className="mb-3 text-xs text-muted-foreground">
        Scale: {formatMoney(max)} · Select a bar for amounts
      </p>
      <div className="overflow-x-auto">
        <div
          className={`flex gap-1 ${view === "daily" ? "min-w-[550px]" : "min-w-[250px]"}`}
        >
          {series.map((day) => (
            <button
              type="button"
              key={day.date}
              className="min-w-0 flex-1 rounded p-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              title={`${day.date}: income ${formatMoney(day.income)}, expenses ${formatMoney(day.expense)}`}
              aria-label={`${day.date}: income ${formatMoney(day.income)}, expenses ${formatMoney(day.expense)}`}
              onClick={() => setSelected(day.date)}
            >
              <div className="flex h-40 items-end justify-center gap-0.5 border-b">
                <div
                  className="w-1/3 rounded-t bg-income"
                  style={{
                    height: Number(day.income)
                      ? `${Math.max(1, (Number(day.income) / max) * 100)}%`
                      : 0,
                  }}
                />
                <div
                  className="w-1/3 rounded-t bg-expense"
                  style={{
                    height: Number(day.expense)
                      ? `${Math.max(1, (Number(day.expense) / max) * 100)}%`
                      : 0,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-muted-foreground">
                {view === "monthly"
                  ? new Date(`${day.date}-01T00:00:00Z`).toLocaleDateString(
                      "en",
                      { month: "short", timeZone: "UTC" },
                    )
                  : Number(day.date.slice(-2))}
              </span>
            </button>
          ))}
        </div>
      </div>
      {point && (
        <p aria-live="polite" className="mt-3 text-sm">
          {point.date}: +{formatMoney(point.income)} / −
          {formatMoney(point.expense)}
        </p>
      )}
    </section>
  );
}
