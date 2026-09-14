import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  LayoutDashboard,
  MoreHorizontal,
  PieChart,
  ReceiptText,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import { Logo } from "../logo";

const chart = [35, 48, 38, 64, 52, 78, 69, 96, 81, 108, 92, 121];

export function DashboardPreview() {
  const nav = [
    [LayoutDashboard, "Overview", true],
    [WalletCards, "Accounts", false],
    [ReceiptText, "Transactions", false],
    [PieChart, "Insights", false],
    [Target, "Goals", false],
  ] as const;
  return (
    <div className="hero-dashboard relative mx-auto mt-12 max-w-280 overflow-hidden rounded-t-[28px] border border-white/10 bg-[#121511] p-2 shadow-[0_-15px_70px_rgba(195,255,57,.10),0_30px_80px_rgba(0,0,0,.38)] sm:p-3">
      <div className="grid min-h-120 overflow-hidden rounded-[20px] border border-white/[.07] bg-[#191d18] md:grid-cols-[185px_1fr]">
        <aside className="hidden border-r border-white/[.07] bg-[#141714] p-4 md:block">
          <Logo />
          <div className="mt-10 space-y-1 text-sm text-[#9ca498]">
            {nav.map(([Icon, label, active]) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-[#293126] text-[#eaffbb]" : ""}`}
              >
                <Icon className="size-4" />
                {label}
              </div>
            ))}
          </div>
          <div className="mt-16 rounded-xl border border-[#d8ff72]/15 bg-[#222a1d] p-3">
            <Sparkles className="size-4 text-[#cbff3d]" />
            <p className="mt-2 text-xs font-medium text-white">
              You&apos;re on a roll.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[#969e91]">
              Your savings are 18% higher this month.
            </p>
          </div>
        </aside>
        <main className="min-w-0 bg-[#1c201b] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#899184]">Monday, 14 September</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Good morning, Sujal{" "}
                <span className="inline-block animate-[wave_2.4s_ease-in-out_infinite]">
                  👋
                </span>
              </h3>
            </div>
            <div className="flex gap-2">
              <div className="grid size-8 place-items-center rounded-lg border border-white/10 text-[#abb3a6]">
                <Bell className="size-4" />
              </div>
              <div className="grid size-8 place-items-center rounded-lg bg-[#dce6d4] text-xs font-bold text-[#1c211a]">
                S
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#d1ff5a]/25 bg-[#283020] p-4 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#b7c2aa]">Total balance</p>
                <MoreHorizontal className="size-4 text-[#849078]" />
              </div>
              <p className="mt-3 text-[28px] font-semibold tracking-[-.06em] text-white">
                ₹ 1,24,850<span className="text-base text-[#9ca597]">.00</span>
              </p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#c9ff3f]/10 px-2 py-1 text-[10px] font-medium text-[#c9ff3f]">
                <ArrowUpRight className="size-3" /> 12.6% from last month
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#232722] p-4">
              <p className="text-xs text-[#9ea79a]">This month</p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                ₹ 32,240
              </p>
              <div className="mt-4 flex items-end gap-1">
                {[10, 18, 12, 25, 15, 31, 22].map((height, i) => (
                  <i
                    key={i}
                    className="w-full rounded-t-sm bg-[#b8dd50]"
                    style={{ height }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_.8fr]">
            <div className="rounded-xl border border-white/8 bg-[#20241f] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Cash flow</p>
                  <p className="mt-0.5 text-[11px] text-[#8e9789]">
                    Income &amp; expenses
                  </p>
                </div>
                <div className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-[#b0b8ab]">
                  Last 12 months <ChevronDown className="ml-1 inline size-3" />
                </div>
              </div>
              <div className="relative mt-5 flex h-32 items-end gap-1.5 border-b border-white/8 px-1">
                {chart.map((height, i) => (
                  <div key={i} className="flex h-full flex-1 items-end">
                    <i
                      style={{ height: `${height * 0.7}%` }}
                      className={`w-full rounded-t-[3px] ${i === 11 ? "bg-[#cbff3d] shadow-[0_0_15px_rgba(203,255,61,.5)]" : "bg-[#65725e]"}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-[#6f796b]">
                <span>OCT</span>
                <span>JAN</span>
                <span>APR</span>
                <span>JUL</span>
                <span>SEP</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#20241f] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Top spending</p>
                <MoreHorizontal className="size-4 text-[#899184]" />
              </div>
              {[
                ["Housing", "₹ 12,000", "bg-[#c9ff3f]"],
                ["Food & dining", "₹ 5,850", "bg-[#f6ba55]"],
                ["Transport", "₹ 2,400", "bg-[#8eaeff]"],
              ].map(([name, value, color]) => (
                <div key={name} className="mt-4 flex items-center gap-2.5">
                  <i className={`size-2.5 rounded-full ${color}`} />
                  <span className="flex-1 text-[11px] text-[#aab3a5]">
                    {name}
                  </span>
                  <span className="text-[11px] font-medium text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#111310] to-transparent" />
    </div>
  );
}
