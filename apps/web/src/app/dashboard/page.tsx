"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Wallet, X } from "lucide-react";

import { useAppSession } from "@/components/providers/session-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { addExpense, addIncome } from "@/server/transactions";
import { dashboardSummaryQuery } from "@/server/summary";
import { asObject } from "@/lib/offline-engine";
import { categoryIcon, currentMonth, expenseCategories, incomeSources } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EntryType = "income" | "expense" | null;
type ExpenseForm = { amount: number; category: (typeof expenseCategories)[number] | ""; description?: string; date: string };
type IncomeForm = { amount: number; source: (typeof incomeSources)[number] | ""; description?: string; date: string };

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: session } = useAppSession();
  const { formatMoney } = usePreferences();
  const [month, setMonth] = useState(currentMonth);
  const [entryType, setEntryType] = useState<EntryType>(null);
  const incomeForm = useForm<IncomeForm>({ defaultValues: { amount: 0, source: "", description: "", date: new Date().toISOString().slice(0, 10) } });
  const expenseForm = useForm<ExpenseForm>({ defaultValues: { amount: 0, category: "", description: "", date: new Date().toISOString().slice(0, 10) } });

  const refreshSummary = () => {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };
  const incomeMutation = useMutation({
    mutationFn: addIncome,
    onSuccess: (result) => {
      toast.success(String(asObject(result).message ?? "Saved successfully"));
      incomeForm.reset();
      setEntryType(null);
      refreshSummary();
    },
  });
  const expenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: (result) => {
      toast.success(String(asObject(result).message ?? "Saved successfully"));
      expenseForm.reset();
      setEntryType(null);
      refreshSummary();
    },
  });
  const onIncomeSubmit = incomeForm.handleSubmit((data) => {
    if (!data.source) {
      incomeForm.setError("source", { type: "required", message: "Select an income source." });
      return;
    }
    incomeMutation.mutate({ amount: data.amount, source: data.source, description: data.description, occurredAt: `${data.date}T00:00:00.000Z` });
  });
  const onExpenseSubmit = expenseForm.handleSubmit((data) => {
    if (!data.category) {
      expenseForm.setError("category", { type: "required", message: "Select an expense category." });
      return;
    }
    expenseMutation.mutate({ amount: data.amount, category: data.category, description: data.description, occurredAt: `${data.date}T00:00:00.000Z` });
  });
  const { data: summary, isPending, error } = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });
  const balance = Number(summary?.data.balance ?? 0);
  const income = Number(summary?.data.income ?? 0);
  const expense = Number(summary?.data.expense ?? 0);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Welcome back, {session?.user.name.split(" ")[0] || "there"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your money</h1>
      </div>
      <MonthPicker month={month} onChange={setMonth} />
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard title="Current balance" value={formatMoney(balance)} icon={Wallet} loading={isPending} />
        <SummaryCard title="Income" value={formatMoney(income)} icon={ArrowUp} loading={isPending} type="income" />
        <SummaryCard title="Expenses" value={formatMoney(expense)} icon={ArrowDown} loading={isPending} type="expense" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      <section aria-label="Add a transaction" className="space-y-4">
        <div>
          <h2 className="font-semibold">Quick actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose what you want to record.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant={entryType === "expense" ? "destructive" : "outline"} className="h-12 justify-start" aria-expanded={entryType === "expense"} onClick={() => setEntryType(entryType === "expense" ? null : "expense")}>
            <Plus className="size-4" /> Add expense
          </Button>
          <Button type="button" variant={entryType === "income" ? "primary" : "outline"} className="h-12 justify-start" aria-expanded={entryType === "income"} onClick={() => setEntryType(entryType === "income" ? null : "income")}>
            <Plus className="size-4" /> Add income
          </Button>
        </div>
        {entryType === "income" && (
          <Card className="rounded-2xl">
            <div className="flex items-center justify-between px-5 pt-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600"><ArrowUp className="size-4" /></span>
                <div><h3 className="font-semibold">Add income</h3><p className="text-sm text-muted-foreground">Record money you received.</p></div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close income form" onClick={() => setEntryType(null)}><X className="size-4" /></Button>
            </div>
            <CardContent className="pt-5">
              <form onSubmit={onIncomeSubmit} className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" id="income-amount">
                  <Input id="income-amount" type="number" min="0.01" step="0.01" inputMode="decimal" disabled={incomeMutation.isPending} {...incomeForm.register("amount", { valueAsNumber: true, required: "Amount is required", min: { value: 0.01, message: "Amount must be greater than 0." } })} />
                  <ErrorText>{incomeForm.formState.errors.amount?.message}</ErrorText>
                </Field>
                <Field label="Source" id="income-source">
                  <Controller control={incomeForm.control} name="source" rules={{ required: "Select an income source." }} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={incomeMutation.isPending}>
                      <SelectTrigger id="income-source" className="w-full"><SelectValue placeholder="Choose a source" /></SelectTrigger>
                      <SelectContent>{incomeSources.map((source) => { const Icon = categoryIcon(source); return <SelectItem key={source} value={source}><span className="flex items-center gap-2"><Icon className="size-4" />{formatLabel(source)}</span></SelectItem>; })}</SelectContent>
                    </Select>
                  )} />
                  <ErrorText>{incomeForm.formState.errors.source?.message}</ErrorText>
                </Field>
                <Field label="Date" id="income-date"><Input id="income-date" type="date" disabled={incomeMutation.isPending} {...incomeForm.register("date", { required: "Date is required." })} /></Field>
                <Field label={<>Description <span className="text-muted-foreground">(optional)</span></>} id="income-description" className="sm:col-span-2"><Textarea id="income-description" rows={2} className="resize-none" placeholder="Where did this money come from?" disabled={incomeMutation.isPending} {...incomeForm.register("description")} /></Field>
                <FormError>{incomeMutation.error?.message}</FormError>
                <Button type="submit" className="sm:col-span-2" disabled={incomeMutation.isPending}>{incomeMutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Adding income…</> : <><Plus className="size-4" /> Add income</>}</Button>
              </form>
            </CardContent>
          </Card>
        )}
        {entryType === "expense" && (
          <Card className="rounded-2xl">
            <div className="flex items-center justify-between px-5 pt-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-red-500/10 p-2 text-red-600"><ArrowDown className="size-4" /></span>
                <div><h3 className="font-semibold">Add expense</h3><p className="text-sm text-muted-foreground">Record money you spent.</p></div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close expense form" onClick={() => setEntryType(null)}><X className="size-4" /></Button>
            </div>
            <CardContent className="pt-5">
              <form onSubmit={onExpenseSubmit} className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" id="expense-amount">
                  <Input id="expense-amount" type="number" min="0.01" step="0.01" inputMode="decimal" disabled={expenseMutation.isPending} {...expenseForm.register("amount", { valueAsNumber: true, required: "Amount is required", min: { value: 0.01, message: "Amount must be greater than 0." } })} />
                  <ErrorText>{expenseForm.formState.errors.amount?.message}</ErrorText>
                </Field>
                <Field label="Category" id="expense-category">
                  <Controller control={expenseForm.control} name="category" rules={{ required: "Select an expense category." }} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={expenseMutation.isPending}>
                      <SelectTrigger id="expense-category" className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>{expenseCategories.map((category) => { const Icon = categoryIcon(category); return <SelectItem key={category} value={category}><span className="flex items-center gap-2"><Icon className="size-4" />{formatLabel(category)}</span></SelectItem>; })}</SelectContent>
                    </Select>
                  )} />
                  <ErrorText>{expenseForm.formState.errors.category?.message}</ErrorText>
                </Field>
                <Field label="Date" id="expense-date"><Input id="expense-date" type="date" disabled={expenseMutation.isPending} {...expenseForm.register("date", { required: "Date is required." })} /></Field>
                <Field label={<>Description <span className="text-muted-foreground">(optional)</span></>} id="expense-description" className="sm:col-span-2"><Textarea id="expense-description" rows={2} className="resize-none" placeholder="What did you spend it on?" disabled={expenseMutation.isPending} {...expenseForm.register("description")} /></Field>
                <FormError>{expenseMutation.error?.message}</FormError>
                <Button type="submit" variant="destructive" className="sm:col-span-2" disabled={expenseMutation.isPending}>{expenseMutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Adding expense…</> : <><Plus className="size-4" /> Add expense</>}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, loading, type }: { title: string; value: string; icon: React.ElementType; loading: boolean; type?: "income" | "expense" }) {
  return (
    <Card className={cn("rounded-2xl", !type && "border-primary/25 bg-primary/5", type === "income" && "bg-emerald-500/10", type === "expense" && "bg-red-500/10")}>
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div className="min-w-0"><p className="text-sm text-muted-foreground">{title}</p>{loading ? <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-muted" /> : <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>}</div>
        <span className="ml-3 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className={cn("size-4 text-muted-foreground", type === "income" && "text-emerald-600", type === "expense" && "text-red-500")} /></span>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children, className }: { label: React.ReactNode; id: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function ErrorText({ children }: { children?: React.ReactNode }) {
  return children ? <p role="alert" className="text-sm text-destructive">{children}</p> : null;
}

function FormError({ children }: { children?: React.ReactNode }) {
  return children ? <p role="alert" className="sm:col-span-2 text-sm text-destructive">{children}</p> : null;
}

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
