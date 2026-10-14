"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { expenseCategories, incomeSources, formatLabel } from "@/lib/finance";
import { getLabels, saveLabel, updateLabel } from "@/server/finance-features";

export default function CategoriesPage() {
  const client = useQueryClient();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const query = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const save = useMutation({ mutationFn: () => { const key = name.trim().toLowerCase().replace(/\s+/g, "-"); return saveLabel({ kind, key, name: name.trim() }); }, onSuccess: () => { setName(""); void client.invalidateQueries({ queryKey: ["finance-labels"] }); } });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => updateLabel(id, { active }), onSuccess: () => void client.invalidateQueries({ queryKey: ["finance-labels"] }) });
  const labels = query.data?.data ?? [];
  const builtins = kind === "expense" ? expenseCategories : incomeSources;
  return <div className="mx-auto max-w-2xl space-y-5 pb-24"><div><h1 className="text-2xl font-semibold tracking-tight">Categories & sources</h1><p className="mt-1 text-sm text-muted-foreground">Add labels for your transactions. Built-in labels stay available.</p></div>
    <div className="flex gap-2">{(["expense", "income"] as const).map((value) => <Button key={value} variant={kind === value ? "default" : "outline"} onClick={() => setKind(value)}>{value === "expense" ? "Expense categories" : "Income sources"}</Button>)}</div>
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (name.trim()) save.mutate(); }}><Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder={kind === "expense" ? "Pet care" : "Side project"} required/><Button type="submit" disabled={save.isPending}><Plus className="size-4"/>Add</Button></form>
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    <section className="overflow-hidden rounded-2xl border bg-card"><h2 className="border-b px-4 py-3 text-sm font-semibold">Built in</h2><ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">{builtins.map((item) => <li key={item} className="bg-card px-4 py-3 text-sm">{formatLabel(item)}</li>)}</ul></section>
    <section className="overflow-hidden rounded-2xl border bg-card"><h2 className="border-b px-4 py-3 text-sm font-semibold">Custom</h2>{query.isPending ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : labels.filter((item) => item.kind === kind).length === 0 ? <p className="p-4 text-sm text-muted-foreground">No custom labels yet.</p> : labels.filter((item) => item.kind === kind).map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-4 last:border-0"><span className="flex-1 text-sm">{item.name}<span className="ml-2 text-xs text-muted-foreground">{item.key}</span></span><Button variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: item.id, active: !item.active })}>{item.active ? "Disable" : "Enable"}</Button></div>)}</section>
  </div>;
}
