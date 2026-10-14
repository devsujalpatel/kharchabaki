"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryPicker } from "@/components/category-picker";
import { expenseCategories, formatLabel, currentMonth, shiftMonth, monthLabel } from "@/lib/finance";
import { usePreferences } from "@/components/providers/preferences-provider";
import { getBudgets, saveBudget, deleteBudget, getLabels } from "@/server/finance-features";

export default function BudgetsPage() {
  const client = useQueryClient();
  const { formatMoney } = usePreferences();
  const [month, setMonth] = useState(currentMonth());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState("80");
  const labels = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const categories = [...expenseCategories, ...(labels.data?.data ?? []).filter((item) => item.kind === "expense" && item.active).map((item) => item.key)];
  const query = useQuery({ queryKey: ["budgets", month], queryFn: () => getBudgets(month) });
  const save = useMutation({
    mutationFn: () => saveBudget({ month, category, amount: Number(amount), alertThreshold: Number(threshold) }),
    onSuccess: () => { setAmount(""); void client.invalidateQueries({ queryKey: ["budgets"] }); },
  });
  const remove = useMutation({ mutationFn: deleteBudget, onSuccess: () => void client.invalidateQueries({ queryKey: ["budgets"] }) });
  const budgets = query.data?.data ?? [];
  const alerts = budgets.filter((budget) => Number(budget.spent) / Number(budget.amount) * 100 >= Number(budget.alertThreshold));
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Budgets</h1><p className="mt-1 text-sm text-muted-foreground">Monthly limits by category.</p></div>
        <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</Button><span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span><Button variant="outline" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</Button></div>
      </div>
      {alerts.length > 0 && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">{alerts.map((budget) => <p key={budget.id}>{formatLabel(budget.category)} has reached {Math.round(Number(budget.spent) / Number(budget.amount) * 100)}% of its budget.</p>)}</div>}
      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); if (category && Number(amount) > 0) save.mutate(); }}>
        <CategoryPicker options={categories} value={category} onChange={setCategory} label="Category" />
        <label className="space-y-2 text-sm"><span>Monthly limit</span><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
        <label className="space-y-2 text-sm"><span>Alert at %</span><Input type="number" min="1" max="100" value={threshold} onChange={(event) => setThreshold(event.target.value)} required /></label>
        <Button type="submit" disabled={save.isPending || !category}><Plus className="size-4"/>Set budget</Button>
      </form>
      {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
      {query.isPending ? <div role="status" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">Loading budgets…</div> : budgets.length === 0 ? <div className="rounded-2xl border p-8 text-center"><Wallet className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm text-muted-foreground">No budgets for this month yet.</p></div> : <div className="space-y-3">{budgets.map((budget) => { const spent = Number(budget.spent); const limit = Number(budget.amount); const progress = limit ? spent / limit * 100 : 0; return <article key={budget.id} className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-medium">{formatLabel(budget.category)}</p><p className="mt-1 text-xs text-muted-foreground">{formatMoney(spent)} spent of {formatMoney(limit)} · {formatMoney(Math.max(0, limit - spent))} left</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${budget.category} budget`} onClick={() => remove.mutate(budget.id)}><Trash2 className="size-4"/></Button></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${budget.category} budget progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(progress))}><div className={`h-full rounded-full ${progress >= Number(budget.alertThreshold) ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, progress)}%` }}/></div></article>; })}</div>}
    </div>
  );
}
