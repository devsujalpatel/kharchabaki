"use client";

import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { formatLabel, type DailyTotal } from "@/lib/finance";

export function CashTrend({ points }: { points: DailyTotal[] }) {
  const { formatMoney } = usePreferences();
  const max = Math.max(
    1,
    ...points.flatMap((p) => [Number(p.income), Number(p.expense)]),
  );
  const x = (i: number) => 30 + (i * 540) / Math.max(1, points.length - 1);
  const y = (v: string) => 170 - (Number(v) / max) * 140;
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">Cash flow trend</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Monthly income and expenses · peak{" "}
        {formatMoney(
          max === 1 &&
            points.every(
              (p) => Number(p.income) === 0 && Number(p.expense) === 0,
            )
            ? 0
            : max,
        )}
      </p>
      {points.every(
        (p) => Number(p.income) === 0 && Number(p.expense) === 0,
      ) ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Add transactions to see your trend.
        </p>
      ) : (
        <svg
          viewBox="0 0 600 210"
          className="mt-4 w-full"
          role="img"
          aria-label="Monthly income and expense line chart"
        >
          <title>Monthly cash flow. Exact values are listed below.</title>
          {[30, 100, 170].map((v) => (
            <line
              key={v}
              x1="30"
              x2="570"
              y1={v}
              y2={v}
              stroke="var(--border)"
              strokeDasharray="4 5"
            />
          ))}
          {(["income", "expense"] as const).map((key) => (
            <g key={key}>
              <polyline
                points={points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ")}
                fill="none"
                stroke={`var(--${key})`}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <circle
                  key={p.date}
                  cx={x(i)}
                  cy={y(p[key])}
                  r="4"
                  fill={`var(--${key})`}
                >
                  <title>
                    {p.date}: {formatMoney(p[key])}
                  </title>
                </circle>
              ))}
            </g>
          ))}
          {points.map((p, i) => (
            <text
              key={p.date}
              x={x(i)}
              y="200"
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {p.date.slice(0, 7)}
            </text>
          ))}
        </svg>
      )}
      <div className="mt-3 flex gap-5 text-xs">
        <span className="text-income">● Income</span>
        <span className="text-expense">● Expenses</span>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">View chart values</summary>
        <ul className="mt-2 space-y-1">
          {points.map((p) => (
            <li key={p.date}>
              {p.date.slice(0, 7)}: income {formatMoney(p.income)} · expenses{" "}
              {formatMoney(p.expense)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function SpendingRadar({
  items,
}: {
  items: { category: string; total: string }[];
}) {
  const { formatMoney } = usePreferences();
  const [view, setView] = useState<"radar" | "pie">("radar");
  const sorted = [...items]
    .filter((p) => Number(p.total) > 0)
    .sort((a, b) => Number(b.total) - Number(a.total));
  const top = sorted.slice(0, 5);
  if (sorted.length > 5)
    top.push({
      category: "remaining categories",
      total: String(sorted.slice(5).reduce((s, p) => s + Number(p.total), 0)),
    });
  const max = Math.max(1, ...top.map((p) => Number(p.total)));
  const count = Math.max(3, top.length);
  const point = (i: number, scale: number) => {
    const a = (i * Math.PI * 2) / count - Math.PI / 2;
    return `${150 + Math.cos(a) * 100 * scale},${140 + Math.sin(a) * 100 * scale}`;
  };
  const colors = [
    "#34c98b",
    "#ef767a",
    "#5d9bf8",
    "#f5b94c",
    "#aa8cf8",
    "#47cde1",
  ];
  const sum = top.reduce((s, p) => s + Number(p.total), 0);
  const gradient = top
    .map((p, i) => {
      const start =
        (top
          .slice(0, i)
          .reduce((value, item) => value + Number(item.total), 0) /
          sum) *
        100;
      const end = start + (Number(p.total) / sum) * 100;
      return `${colors[i]} ${start}% ${end}%`;
    })
    .join(",");
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Spending shape</h2>
        <div className="flex gap-2">
          {(["radar", "pie"] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg border px-3 py-2 text-xs capitalize ${view === v ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {!top.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No expenses in this period.
        </p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-2">
          {view === "radar" ? (
            <svg
              viewBox="0 0 300 280"
              role="img"
              aria-label="Expense categories relative to the largest category"
            >
              <title>Category spending radar; numbers match the legend.</title>
              {[0.25, 0.5, 0.75, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={Array.from({ length: count }, (_, i) =>
                    point(i, scale),
                  ).join(" ")}
                  fill="none"
                  stroke="var(--border)"
                />
              ))}
              {Array.from({ length: count }, (_, i) => (
                <line
                  key={i}
                  x1="150"
                  y1="140"
                  x2={point(i, 1).split(",")[0]}
                  y2={point(i, 1).split(",")[1]}
                  stroke="var(--border)"
                />
              ))}
              <polygon
                points={Array.from({ length: count }, (_, i) =>
                  point(i, Number(top[i]?.total ?? 0) / max),
                ).join(" ")}
                fill="var(--primary)"
                fillOpacity=".18"
                stroke="var(--primary)"
                strokeWidth="2"
              />
              {top.map((p, i) => (
                <text
                  key={p.category}
                  x={point(i, 1.2).split(",")[0]}
                  y={point(i, 1.2).split(",")[1]}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  fontSize="12"
                >
                  {i + 1}
                </text>
              ))}
            </svg>
          ) : (
            <div
              role="img"
              aria-label="Expense distribution pie chart; amounts and percentages follow"
              className="mx-auto my-6 aspect-square w-48 rounded-full"
              style={{ background: `conic-gradient(${gradient})` }}
            />
          )}
          <ol className="space-y-3 text-sm">
            {top.map((p, i) => (
              <li key={p.category} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: colors[i] }}
                />
                <span className="flex-1">
                  {i + 1}. {formatLabel(p.category)}
                </span>
                <span className="text-right tabular-nums">
                  {formatMoney(p.total)}
                  <span className="block text-xs text-muted-foreground">
                    {((Number(p.total) / sum) * 100).toFixed(1)}%
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
