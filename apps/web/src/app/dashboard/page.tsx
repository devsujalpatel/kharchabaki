"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Wallet, Plus, Loader2 } from "lucide-react";

import { addIncome, addExpense } from "@/server/transactions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  expenseCategories,
  incomeSources,
  currentMonth,
  categoryIcon,
} from "@/lib/finance";
import { usePreferences } from "@/components/providers/preferences-provider";
import { MonthPicker } from "@/components/month-picker";
import { MonthlyChart } from "@/components/monthly-chart";
import { dashboardSummaryQuery } from "@/server/summary";

type ExpenseForm = {
  amount: number;
  category: (typeof expenseCategories)[number] | "";
  description?: string;
  date: string;
};

type IncomeForm = {
  amount: number;
  source: (typeof incomeSources)[number] | "";
  description?: string;
  date: string;
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { formatMoney } = usePreferences();
  const [month, setMonth] = useState(currentMonth);

  const incomeForm = useForm<IncomeForm>({
    defaultValues: {
      amount: 0,
      source: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const expenseForm = useForm<ExpenseForm>({
    defaultValues: {
      amount: 0,
      category: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const incomeMutation = useMutation({
    mutationFn: addIncome,

    onSuccess: () => {
      incomeForm.reset();

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary"],
      });
    },
  });

  const expenseMutation = useMutation({
    mutationFn: addExpense,

    onSuccess: () => {
      expenseForm.reset();

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary"],
      });
    },
  });

  const onIncomeSubmit = incomeForm.handleSubmit((data) => {
    if (!data.source) {
      incomeForm.setError("source", {
        type: "required",
        message: "Please select an income source",
      });

      return;
    }

    incomeMutation.mutate({
      amount: data.amount,
      source: data.source,
      description: data.description,
      occurredAt: `${data.date}T00:00:00.000Z`,
    });
  });

  const onExpenseSubmit = expenseForm.handleSubmit((data) => {
    if (!data.category) {
      expenseForm.setError("category", {
        type: "required",
        message: "Please select a category",
      });

      return;
    }

    expenseMutation.mutate({
      amount: data.amount,
      category: data.category,
      description: data.description,
      occurredAt: `${data.date}T00:00:00.000Z`,
    });
  });

  const {
    data: summary,
    isPending: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });

  const balance = Number(summary?.data.balance ?? 0);
  const income = Number(summary?.data.income ?? 0);
  const expense = Number(summary?.data.expense ?? 0);

  const loading = isSummaryLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="sm:mt-20">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Keep track of your money without the noise.
        </p>
      </div>

      <MonthPicker month={month} onChange={setMonth} />
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Current Balance"
          value={formatMoney(balance)}
          icon={Wallet}
          loading={loading}
        />

        <SummaryCard
          title="Monthly Income"
          value={formatMoney(income)}
          icon={ArrowUp}
          loading={loading}
          type="income"
        />

        <SummaryCard
          title="Monthly Expenses"
          value={formatMoney(expense)}
          icon={ArrowDown}
          loading={loading}
          type="expense"
        />
      </div>

      {summaryError && (
        <p role="alert" className="text-destructive">
          {summaryError.message}
        </p>
      )}
      {summary && (
        <MonthlyChart
          key={month}
          daily={summary.data.daily}
          monthly={summary.data.monthly}
        />
      )}
      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income */}
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ArrowUp className="size-4" />
              </div>

              <div>
                <CardTitle className="text-base">Add income</CardTitle>

                <p className="text-sm text-muted-foreground">
                  Record money you received.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={onIncomeSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="income-amount">Amount</Label>

                <Input
                  id="income-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5000"
                  disabled={incomeMutation.isPending}
                  {...incomeForm.register("amount", {
                    valueAsNumber: true,
                    required: "Amount is required",
                    min: {
                      value: 0.01,
                      message: "Amount must be greater than 0",
                    },
                  })}
                />

                {incomeForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {incomeForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Source</Label>

                <Controller
                  control={incomeForm.control}
                  name="source"
                  rules={{
                    required: "Please select an income source",
                  }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={incomeMutation.isPending}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select income source" />
                      </SelectTrigger>

                      <SelectContent>
                        {incomeSources.map((source) => {
                          const Icon = categoryIcon(source);
                          return (
                            <SelectItem key={source} value={source}>
                              <span className="flex items-center gap-2">
                                <Icon className="size-4" />
                                {formatLabel(source)}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />

                {incomeForm.formState.errors.source && (
                  <p className="text-sm text-destructive">
                    Please select an income source.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="income-date">Date</Label>
                <Input
                  id="income-date"
                  type="date"
                  disabled={incomeMutation.isPending}
                  {...incomeForm.register("date", {
                    required: "Date is required",
                  })}
                />
                {incomeForm.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {incomeForm.formState.errors.date.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="income-description">
                  Description
                  <span className="ml-1 text-muted-foreground">(optional)</span>
                </Label>

                <Textarea
                  id="income-description"
                  placeholder="Where did this money come from?"
                  className="resize-none"
                  rows={3}
                  disabled={incomeMutation.isPending}
                  {...incomeForm.register("description")}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={incomeMutation.isPending}
              >
                {incomeMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add income
                  </>
                )}
              </Button>

              {incomeMutation.isError && (
                <p className="text-sm text-destructive">
                  {incomeMutation.error.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Expense */}
        <Card className="rounded-2xl mb-20 sm:mb-0">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                <ArrowDown className="size-4" />
              </div>

              <div>
                <CardTitle className="text-base">Add expense</CardTitle>

                <p className="text-sm text-muted-foreground">
                  Record money you spent.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={onExpenseSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount</Label>

                <Input
                  id="expense-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500"
                  disabled={expenseMutation.isPending}
                  {...expenseForm.register("amount", {
                    valueAsNumber: true,
                    required: "Amount is required",
                    min: {
                      value: 0.01,
                      message: "Amount must be greater than 0",
                    },
                  })}
                />

                {expenseForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {expenseForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>

                <Controller
                  control={expenseForm.control}
                  name="category"
                  rules={{
                    required: "Please select a category",
                  }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={expenseMutation.isPending}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select expense category" />
                      </SelectTrigger>

                      <SelectContent>
                        {expenseCategories.map((category) => {
                          const Icon = categoryIcon(category);
                          return (
                            <SelectItem key={category} value={category}>
                              <span className="flex items-center gap-2">
                                <Icon className="size-4" />
                                {formatLabel(category)}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />

                {expenseForm.formState.errors.category && (
                  <p className="text-sm text-destructive">
                    {expenseForm.formState.errors.category.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  disabled={expenseMutation.isPending}
                  {...expenseForm.register("date", {
                    required: "Date is required",
                  })}
                />
                {expenseForm.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {expenseForm.formState.errors.date.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description
                  <span className="ml-1 text-muted-foreground">(optional)</span>
                </Label>

                <Textarea
                  id="description"
                  placeholder="What did you spend it on?"
                  className="resize-none"
                  rows={3}
                  disabled={expenseMutation.isPending}
                  {...expenseForm.register("description")}
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={expenseMutation.isPending}
              >
                {expenseMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add expense
                  </>
                )}
              </Button>

              {expenseMutation.isError && (
                <p className="text-sm text-destructive">
                  {expenseMutation.error.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  loading,
  className,
  type,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
  className?: string;
  type?: "income" | "expense";
}) {
  return (
    <Card
      className={cn(
        "rounded-2xl",
        className,
        `${type === "income" && "bg-emerald-500/15"}`,
        `${type === "expense" && "bg-red-500/15"}`,
      )}
    >
      <CardContent className="flex items-center justify-between p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>

          {loading ? (
            <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
        </div>

        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon
            className={cn(
              "size-4 text-muted-foreground",
              `${type === "income" && "text-emerald-500"}`,
              `${type === "expense" && "text-red-500"}`,
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
