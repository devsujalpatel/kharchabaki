"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Bolt,
  Check,
  Command,
  CreditCard,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { DashboardPreview } from "@/components/hero/dashboard-preview";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const features = [
    {
      icon: LayoutDashboard,
      title: "A view that clicks",
      body: "See every account, category, and upcoming bill in one delightfully clear home.",
      color: "bg-[#cbff3d] text-[#1b2317]",
    },
    {
      icon: ReceiptText,
      title: "Expense tracking, effortless",
      body: "Add a transaction in seconds. Smart categories learn how you spend.",
      color: "bg-[#bbccff] text-[#1c2544]",
    },
    {
      icon: Target,
      title: "Goals you can feel",
      body: "Turn big plans into small, satisfying progress—one transfer at a time.",
      color: "bg-[#f3bb68] text-[#38250c]",
    },
  ];
  const steps = [
    [
      "01",
      "Connect your world",
      "Bring in your accounts or start fresh. You’re in control, always.",
      CreditCard,
    ],
    [
      "02",
      "Make it yours",
      "Set budgets around what matters, not arbitrary categories.",
      Command,
    ],
    [
      "03",
      "Watch the picture sharpen",
      "Get gentle insights that make your next move obvious.",
      Bolt,
    ],
  ] as const;
  return (
    <main className="min-h-screen overflow-hidden bg-[#111310] text-[#f4f6ee]">
      <section className="relative border-b border-white/[.07]">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute left-1/2 top-0 h-132.5 w-162.5 -translate-x-1/2 rounded-full bg-[#a7e636]/13 blur-[125px]" />
        <nav className="relative mx-auto flex h-19.5 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo />
          <div className="hidden items-center gap-7 text-sm text-[#a9afa5] md:flex">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Button
              variant="ghost"
              className="text-[#d9ddd4] hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Button>
            <Button className="bg-[#cbff3d] px-4 font-semibold text-[#182014] hover:bg-[#dbff72]">
              Start for free <ArrowRight />
            </Button>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="grid size-10 place-items-center rounded-lg border border-white/10 md:hidden"
          >
            <Menu className="size-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-5 top-16 z-20 w-52 rounded-xl border border-white/10 bg-[#20241d] p-3 shadow-2xl md:hidden">
              <button
                className="absolute right-2 top-2 text-[#9ba594]"
                onClick={() => setMenuOpen(false)}
              >
                <X className="size-4" />
              </button>
              {["Features", "How it works", "Pricing", "FAQ"].map((x) => (
                <a
                  key={x}
                  href={`#${x.toLowerCase().replaceAll(" ", "-")}`}
                  className="block rounded-md px-3 py-2 text-sm text-[#cdd2c7] hover:bg-white/5"
                >
                  {x}
                </a>
              ))}
              <Button className="mt-2 w-full bg-[#cbff3d] text-[#172011]">
                Start for free
              </Button>
            </div>
          )}
        </nav>
        <div className="relative mx-auto max-w-5xl px-5 pb-0 pt-16 text-center sm:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#caff3d]/25 bg-[#caff3d]/8 px-3 py-1.5 text-xs font-medium text-[#d9ff83]">
            <Sparkles className="size-3.5" />
            The calm way to manage money
          </div>
          <h1 className="mt-7 text-balance text-5xl font-semibold leading-[.97] tracking-[-.075em] text-white sm:text-7xl lg:text-[84px]">
            Spend with clarity.
            <br />
            <span className="text-[#cbff3d]">Save with intent.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-[#a7afa0] sm:text-lg">
            Kharchabaki turns your everyday money into a simple, beautiful
            picture—so every rupee has a purpose.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 bg-[#cbff3d] px-5 font-semibold text-[#172011] hover:bg-[#dcff77]"
            >
              Start tracking for free <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-white/15 bg-white/3 px-5 text-white hover:bg-white/8 hover:text-white"
            >
              <span className="grid size-5 place-items-center rounded-full bg-white text-[9px] text-black">
                ▶
              </span>{" "}
              See how it works
            </Button>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#8e9789]">
            <Check className="size-3.5 text-[#cbff3d]" />
            No credit card needed <span className="mx-1 text-white/20">
              •
            </span>{" "}
            Free forever plan
          </div>
          <DashboardPreview />
        </div>
      </section>
      <section id="features" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-[#bce757]">
              Built for real life
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.055em] text-white sm:text-5xl">
              Your money, in focus.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[#9ea69a]">
            Everything you need to make better decisions, without the
            spreadsheet headache.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body, color }) => (
            <article
              key={title}
              className="group relative min-h-62.5 overflow-hidden rounded-2xl border border-white/9 bg-[#191c18] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div
                className={`grid size-11 place-items-center rounded-xl ${color}`}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="mt-8 text-xl font-medium tracking-tight text-white">
                {title}
              </h3>
              <p className="mt-2 max-w-66.25 text-sm leading-relaxed text-[#9ba397]">
                {body}
              </p>
              <ArrowUpRight className="absolute bottom-6 right-6 size-5 text-[#829077] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              <div className="absolute -bottom-16 -right-12 size-44 rounded-full border border-white/6" />
            </article>
          ))}
        </div>
      </section>
      <section
        id="how-it-works"
        className="border-y border-white/[.07] bg-[#171a16] py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-[#bce757]">
              A better money ritual
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.055em] text-white sm:text-5xl">
              Three steps to a little more peace.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#9ba397]">
              The best financial system is one you&apos;ll actually come back
              to. We made that one.
            </p>
            <Button className="mt-8 bg-[#cbff3d] text-[#172011] hover:bg-[#ddff80]">
              Make money make sense <ArrowRight />
            </Button>
          </div>
          <div className="space-y-3">
            {steps.map(([number, title, copy, Icon], i) => (
              <div
                className={`group flex gap-5 rounded-2xl border p-5 transition-colors ${i === 0 ? "border-[#caff3d]/25 bg-[#252c1e]" : "border-white/[.07] bg-[#1c201b] hover:border-white/15"}`}
                key={title}
              >
                <span
                  className={`font-mono text-xs ${i === 0 ? "text-[#d5ff62]" : "text-[#727b6e]"}`}
                >
                  {number}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium text-white">{title}</h3>
                  <p className="mt-1 text-sm text-[#9ca598]">{copy}</p>
                </div>
                <Icon
                  className={`size-5 ${i === 0 ? "text-[#cbff3d]" : "text-[#849078]"}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        id="pricing"
        className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8"
      >
        <div className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#caff3d]/5 blur-[100px]" />
        <div className="relative overflow-hidden rounded-3xl border border-[#d5ff62]/20 bg-[#20261c] px-6 py-12 text-center sm:px-12">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#cbff3d] text-[#172011]">
              <BadgeIndianRupee className="size-6" />
            </div>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-.06em] text-white sm:text-5xl">
              A richer life doesn&apos;t
              <br />
              need a pricey app.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#aab3a1]">
              Start with everything you need, completely free. Upgrade only when
              your ambitions do.
            </p>
            <div className="mx-auto mt-7 flex w-fit flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#d2d8ca]">
              <span>
                <Check className="mr-1 inline size-3 text-[#cbff3d]" />
                Free forever plan
              </span>
              <span>
                <Check className="mr-1 inline size-3 text-[#cbff3d]" />
                No ads, ever
              </span>
              <span>
                <Check className="mr-1 inline size-3 text-[#cbff3d]" />
                Your data is yours
              </span>
            </div>
            <Button
              size="lg"
              className="mt-8 h-12 bg-[#cbff3d] px-5 font-semibold text-[#172011] hover:bg-[#deff7e]"
            >
              Get started—it&apos;s free <ArrowRight />
            </Button>
          </div>
        </div>
      </section>
      <footer id="faq" className="border-t border-white/[.07] bg-[#0c0e0c]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <Logo />
            <p className="mt-3 text-xs text-[#778071]">
              Make every rupee count.
            </p>
          </div>
          <div className="flex gap-5 text-xs text-[#929b8c]">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">Privacy</a>
          </div>
          <p className="text-xs text-[#697263]">© 2026 Kharchabaki</p>
        </div>
      </footer>
    </main>
  );
}
