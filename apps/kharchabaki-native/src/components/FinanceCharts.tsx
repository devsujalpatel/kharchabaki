import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Path, Text as SvgText } from "react-native-svg";
import { usePreferences } from "@/lib/preferences";
import { formatLabel, type DailyTotal } from "@/lib/finance";

const chartColors = ["#34c98b", "#ef767a", "#5d9bf8", "#f5b94c", "#aa8cf8", "#47cde1"];
export function CashTrend({ points }: { points: DailyTotal[] }) {
  const { colors, formatMoney } = usePreferences();
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => [Number(p.income), Number(p.expense)]));
  const empty = points.every((p) => !Number(p.income) && !Number(p.expense));
  const x = (i: number) => 25 + (i * 550) / Math.max(1, points.length - 1);
  const y = (value: string) => 160 - (Number(value) / max) * 130;
  const detail = points.find((p) => p.date === selected);
  return (
    <View className="mt-5 rounded-3xl border border-app-border bg-app-card p-5">
      <Text className="text-base font-semibold text-app-text">Cash flow trend</Text>
      <Text className="mt-1 text-xs text-app-subtle">
        Monthly income and expenses · Peak {formatMoney(empty ? 0 : max)}
      </Text>
      {empty ? (
        <Text className="py-8 text-center text-sm text-app-subtle">
          Add transactions to see your trend.
        </Text>
      ) : (
        <View className="mt-4">
          <Svg
            width="100%"
            height={180}
            viewBox="0 0 600 200"
            accessibilityLabel="Monthly cash flow line chart. Values are available using the month buttons below."
          >
            {[30, 95, 160].map((v) => (
              <Line
                key={v}
                x1="25"
                x2="575"
                y1={v}
                y2={v}
                stroke={colors.border}
                strokeDasharray="4 5"
              />
            ))}
            {(["income", "expense"] as const).map((key, side) => (
              <Polyline
                key={key}
                points={points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ")}
                fill="none"
                stroke={chartColors[side]}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ))}
            {points.map((p, i) => (
              <SvgText
                key={p.date}
                x={x(i)}
                y={195}
                textAnchor="middle"
                fontSize={14}
                fill={colors.subtle}
              >
                {p.date.slice(5, 7)}
              </SvgText>
            ))}
          </Svg>
        </View>
      )}
      <View className="mt-3 flex-row gap-4">
        <Text style={{ color: chartColors[0] }} className="text-xs">
          ● Income
        </Text>
        <Text style={{ color: chartColors[1] }} className="text-xs">
          ● Expenses
        </Text>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {points.map((p) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selected === p.date }}
            accessibilityLabel={`${p.date}: income ${formatMoney(p.income)}, expenses ${formatMoney(p.expense)}`}
            key={p.date}
            onPress={() => setSelected(p.date)}
            className={`min-h-11 items-center justify-center rounded-lg px-2 ${selected === p.date ? "bg-app-primary/10" : "bg-app-muted"}`}
          >
            <Text className="text-xs text-app-text">{p.date.slice(0, 7)}</Text>
          </Pressable>
        ))}
      </View>
      {detail && (
        <Text className="mt-3 text-sm text-app-text">
          {detail.date.slice(0, 7)} · Income {formatMoney(detail.income)} · Expenses{" "}
          {formatMoney(detail.expense)}
        </Text>
      )}
    </View>
  );
}
export function SpendingShape({ items }: { items: { category: string; total: string }[] }) {
  const { colors, formatMoney } = usePreferences();
  const [view, setView] = useState<"radar" | "pie">("radar");
  const sorted = [...items]
    .filter((p) => Number(p.total) > 0)
    .sort((a, b) => Number(b.total) - Number(a.total));
  const top = sorted.slice(0, 5);
  if (sorted.length > 5)
    top.push({
      category: "remaining-categories",
      total: String(sorted.slice(5).reduce((sum, p) => sum + Number(p.total), 0)),
    });
  const max = Math.max(1, ...top.map((p) => Number(p.total)));
  const sum = top.reduce((s, p) => s + Number(p.total), 0);
  const count = Math.max(3, top.length);
  const xy = (angle: number, radius: number) => [
    150 + Math.cos(angle) * radius,
    140 + Math.sin(angle) * radius,
  ];
  const point = (i: number, scale: number) =>
    xy((i * Math.PI * 2) / count - Math.PI / 2, 100 * scale).join(",");
  return (
    <View className="mt-5 rounded-3xl border border-app-border bg-app-card p-5">
      <Text className="text-base font-semibold text-app-text">Spending shape</Text>
      <View className="mt-3 flex-row gap-2">
        {(["radar", "pie"] as const).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: view === v }}
            onPress={() => setView(v)}
            className={`min-h-11 justify-center rounded-xl px-4 ${view === v ? "bg-app-primary" : "bg-app-muted"}`}
          >
            <Text className={`text-xs ${view === v ? "text-app-on-primary" : "text-app-text"}`}>
              {formatLabel(v)}
            </Text>
          </Pressable>
        ))}
      </View>
      {!top.length ? (
        <Text className="py-8 text-center text-sm text-app-subtle">
          No expenses in this period.
        </Text>
      ) : (
        <>
          <Svg
            width="100%"
            height={250}
            viewBox="0 0 300 280"
            accessibilityLabel={
              view === "radar"
                ? "Expense categories relative to the largest category. Exact values follow."
                : "Expense distribution pie chart. Exact percentages follow."
            }
          >
            {view === "radar" ? (
              <>
                {[0.25, 0.5, 0.75, 1].map((scale) => (
                  <Polygon
                    key={scale}
                    points={Array.from({ length: count }, (_, i) => point(i, scale)).join(" ")}
                    fill="none"
                    stroke={colors.border}
                  />
                ))}
                <Polygon
                  points={Array.from({ length: count }, (_, i) =>
                    point(i, Number(top[i]?.total ?? 0) / max)
                  ).join(" ")}
                  fill={colors.primary}
                  fillOpacity={0.18}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
                {top.map((p, i) => {
                  const [x, y] = point(i, 1.2).split(",");
                  return (
                    <SvgText
                      key={p.category}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fill={colors.foreground}
                      fontSize={13}
                    >
                      {i + 1}
                    </SvgText>
                  );
                })}
              </>
            ) : (
              top.map((p, i) => {
                const angle = (Number(p.total) / sum) * Math.PI * 2;
                const start =
                  (top.slice(0, i).reduce((value, item) => value + Number(item.total), 0) / sum) *
                    Math.PI *
                    2 -
                  Math.PI / 2;
                const [x1, y1] = xy(start, 100);
                const [x2, y2] = xy(start + angle, 100);
                return angle >= Math.PI * 2 - 0.00001 ? (
                  <Circle key={p.category} cx={150} cy={140} r={100} fill={chartColors[i]} />
                ) : (
                  <Path
                    key={p.category}
                    d={`M 150 140 L ${x1} ${y1} A 100 100 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`}
                    fill={chartColors[i]}
                  />
                );
              })
            )}
          </Svg>
          {top.map((p, i) => (
            <View key={p.category} className="mb-3 flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[i] }} />
              <Text className="flex-1 text-xs text-app-text">
                {i + 1}. {formatLabel(p.category)}
              </Text>
              <View>
                <Text className="text-right text-xs font-semibold text-app-text">
                  {formatMoney(p.total)}
                </Text>
                <Text className="mt-1 text-right text-xs text-app-subtle">
                  {((Number(p.total) / sum) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
