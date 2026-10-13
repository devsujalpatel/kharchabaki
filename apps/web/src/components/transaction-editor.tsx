"use client";

import { useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  expenseCategories,
  incomeSources,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { updateTransaction, type Transaction } from "@/server/transactions";
import { CategoryPicker } from "@/components/category-picker";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState(transaction.amount);
  const [category, setCategory] = useState(
    transaction.source ?? transaction.category ?? "other",
  );
  const [description, setDescription] = useState(transaction.description ?? "");
  const [date, setDate] = useState(transaction.occurredAt.slice(0, 10));
  const isIncome = transaction.type === "income";
  const mutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async () => {
      await Promise.all(
        ["transactions", "dashboard-summary", "balance"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onClose();
    },
  });
  return (
    <FormDialog
      title={`Edit ${transaction.type}`}
      icon={Pencil}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !date)
            return;
          mutation.mutate({
            transaction,
            data: {
              amount: Number(amount),
              description,
              occurredAt:
                date === transaction.occurredAt.slice(0, 10)
                  ? transaction.occurredAt
                  : `${date}T00:00:00.000Z`,
              ...(isIncome
                ? { source: category as IncomeSource }
                : { category: category as ExpenseCategory }),
            },
          });
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Amount</span>
            <Input
              type="number"
              min="0.01"
              max="999999999999.99"
              step="0.01"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 rounded-2xl bg-background/40 text-2xl font-semibold tabular-nums md:text-2xl"
            />
          </label>
          <CategoryPicker
            options={isIncome ? incomeSources : expenseCategories}
            value={category}
            onChange={setCategory}
            label={isIncome ? "Source" : "Category"}
            disabled={mutation.isPending}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium">Date</span>
            <Input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 rounded-xl"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              Note{" "}
              <span className="text-xs font-normal text-muted-foreground">
                optional
              </span>
            </span>
            <Textarea
              maxLength={1000}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="resize-none rounded-xl"
            />
          </label>
        </fieldset>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <Button
          disabled={mutation.isPending || !amount || !date}
          type="submit"
          className="h-12 w-full rounded-xl font-semibold"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}{" "}
          Save changes
        </Button>
      </form>
    </FormDialog>
  );
}
