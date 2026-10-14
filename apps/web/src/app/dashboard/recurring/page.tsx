"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreferences } from "@/components/providers/preferences-provider";
import { getRecurring, saveRecurring, deleteRecurring } from "@/server/finance-features";
import { formatLabel } from "@/lib/finance";

export default function RecurringPage() {
  const client = useQueryClient();
  const { formatMoney } = usePreferences();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [schedule, setSchedule] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const query = useQuery({ queryKey: ["recurring"], queryFn: getRecurring });
  const save = useMutation({
    mutationFn: () => saveRecurring({ type, amount: Number(amount), category, schedule, interval: 1, startAt: new Date(`${startAt}T00:00:00Z`).toISOString(), endAt: null, enabled: true, description: null }),
    onSuccess: () => { setAmount(""); void client.invalidateQueries({ queryKey: ["recurring"] }); void client.invalidateQueries({ queryKey: ["transactions"] }); void client.invalidateQueries({ queryKey: ["balance"] }); },
  });
  const remove = useMutation({ mutationFn: deleteRecurring, onSuccess: () => void client.invalidateQueries({ queryKey: ["recurring"] }) });
  const rows = query.data?.data ?? [];
  return <div className="mx-auto max-w-3xl space-y-5 pb-24">
    <div><h1 className="text-2xl font-semibold tracking-tight">Recurring</h1><p className="mt-1 text-sm text-muted-foreground">Due entries are added automatically when the app checks your schedule.</p></div>
    <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (category && Number(amount) > 0) save.mutate(); }}>
      <label className="space-y-2 text-sm"><span>Type</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label className="space-y-2 text-sm"><span>Amount</span><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label className="space-y-2 text-sm"><span>Category / source</span><Input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={100} required /></label>
      <label className="space-y-2 text-sm"><span>Frequency</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={schedule} onChange={(event) => setSchedule(event.target.value as typeof schedule)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
      <label className="space-y-2 text-sm"><span>First due date</span><Input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label>
      <Button className="self-end" type="submit" disabled={save.isPending}><Plus className="size-4"/>Add schedule</Button>
    </form>
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    {query.isPending ? <div role="status" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">Loading schedules…</div> : rows.length === 0 ? <div className="rounded-2xl border p-8 text-center"><CalendarClock className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm text-muted-foreground">No recurring entries yet.</p></div> : <div className="divide-y rounded-2xl border bg-card">{rows.map((row) => <article key={row.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-medium">{formatMoney(row.amount)} · {formatLabel(row.category)}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{row.type} · {row.schedule} · Next {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(row.nextRunAt))}</p></div><Button variant="ghost" size="icon" aria-label="Delete recurring schedule" onClick={() => remove.mutate(row.id)}><Trash2 className="size-4"/></Button></article>)}</div>}
  </div>;
}
