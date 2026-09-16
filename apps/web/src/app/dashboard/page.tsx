"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Wallet, Plus, Loader2 } from "lucide-react";

import { balanceQuery } from "@/server/balance";
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

const expenseCategories = [
  "food",
  "travel",
  "shopping",
  "bills",
  "rent",
  "phone",
  "beauty",
  "clothing",
  "fuel",
  "gifts",
  "electronics",
  "snacks",
  "vegetables",
  "fruits",
  "repairs",
  "health",
  "education",
  "entertainment",
  "other",
] as const;

const incomeSources = [
  "salary",
  "pocket-money",
  "gift",
  "part-time",
  "investment",
  "bonus",
  "other",
] as const;

type IncomeForm = {
  amount: number;
  source: (typeof incomeSources)[number] | "";
  description?: string;
};

type ExpenseForm = {
  amount: number;
  category: (typeof expenseCategories)[number] | "";
  description?: string;
};

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: balanceData, isPending: isBalanceLoading } = useQuery({
    queryKey: ["balance"],
    queryFn: balanceQuery,
  });

  /*
   * These should be backed by your API.
   *
   * Example:
   * GET /income/summary
   * GET /expense/summary
   *
   * For now, they can be fetched from your dashboard endpoint.
   */

  const { data: summary, isPending: isSummaryLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      // Replace this with your real API call
      return {
        income: 0,
        expense: 0,
      };
    },
  });

  type IncomeForm = {
    amount: number;
    source: (typeof incomeSources)[number] | "";
    description?: string;
  };

  const incomeForm = useForm<IncomeForm>({
    defaultValues: {
      amount: 0,
      source: "",
      description: "",
    },
  });

  const expenseForm = useForm<ExpenseForm>({
    defaultValues: {
      amount: 0,
      category: "",
      description: "",
    },
  });

  const incomeMutation = useMutation({
    mutationFn: addIncome,

    onSuccess: () => {
      incomeForm.reset();

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
    });
  });
  const balance = Number(balanceData?.data.balance ?? 0);
  const income = Number(summary?.income ?? 0);
  const expense = Number(summary?.expense ?? 0);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);

  const loading = isBalanceLoading || isSummaryLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Keep track of your money without the noise.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Current Balance"
          value={formatMoney(balance)}
          icon={Wallet}
          loading={loading}
        />

        <SummaryCard
          title="Total Income"
          value={formatMoney(income)}
          icon={ArrowUp}
          loading={loading}
        />

        <SummaryCard
          title="Total Expenses"
          value={formatMoney(expense)}
          icon={ArrowDown}
          loading={loading}
        />
      </div>

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
                        {incomeSources.map((source) => (
                          <SelectItem key={source} value={source}>
                            {formatLabel(source)}
                          </SelectItem>
                        ))}
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
        <Card className="rounded-2xl">
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
                        {expenseCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {formatLabel(category)}
                          </SelectItem>
                        ))}
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
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card className="rounded-2xl">
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
          <Icon className="size-4 text-muted-foreground" />
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
