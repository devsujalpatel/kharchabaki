"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  expenseCategories,
  incomeSources,
  formatLabel,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { updateTransaction, type Transaction } from "@/server/transactions";
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
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [amount, setAmount] = useState(transaction.amount);
  const [category, setCategory] = useState(
    transaction.source ?? transaction.category ?? "other",
  );
  const [description, setDescription] = useState(transaction.description ?? "");
  const [date, setDate] = useState(transaction.occurredAt.slice(0, 10));
  const options =
    transaction.type === "income" ? incomeSources : expenseCategories;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
    <dialog
      ref={dialog}
      aria-labelledby="edit-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.isPending) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/60"
    >
      <h2 id="edit-title" className="mb-5 text-lg font-semibold">
        Edit {transaction.type}
      </h2>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            transaction,
            data: {
              amount: Number(amount),
              description,
              occurredAt:
                date === transaction.occurredAt.slice(0, 10)
                  ? transaction.occurredAt
                  : `${date}T00:00:00.000Z`,
              ...(transaction.type === "income"
                ? { source: category as IncomeSource }
                : { category: category as ExpenseCategory }),
            },
          });
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <label className="block space-y-2">
            <span>Amount</span>
            <Input
              autoFocus
              type="number"
              min="0.01"
              max="999999999999.99"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span>{transaction.type === "income" ? "Source" : "Category"}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-lg border bg-card px-3"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span>Date</span>
            <Input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span>Description</span>
            <Textarea
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </fieldset>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !amount || !date}
            type="submit"
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
