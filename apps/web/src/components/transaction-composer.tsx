"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLabels } from "@/server/finance-features";
import { ArrowDown, ArrowUp, Check, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addExpense, addIncome } from "@/server/transactions";
import {
  expenseCategories,
  incomeSources,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { CategoryPicker } from "@/components/category-picker";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TransactionComposer({
  type,
  onClose,
}: {
  type: "income" | "expense";
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [validation, setValidation] = useState("");
  const isIncome = type === "income";
  const labels = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const customOptions = (labels.data?.data ?? []).filter((item) => item.active && item.kind === type).map((item) => item.key);
  const options = [...new Set([...(isIncome ? incomeSources : expenseCategories), ...customOptions])];
  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        amount: Number(amount),
        description,
        occurredAt: `${date}T00:00:00.000Z`,
      };
      return isIncome
        ? addIncome({ ...data, source: category as IncomeSource })
        : addExpense({ ...data, category: category as ExpenseCategory });
    },
    onSuccess: () => {
      toast.success("Saved");
      for (const key of ["transactions", "balance", "dashboard-summary"])
        void client.invalidateQueries({ queryKey: [key] });
      onClose();
    },
  });
  return (
    <FormDialog
      title={`Add ${type}`}
      icon={isIncome ? ArrowUp : ArrowDown}
      busy={mutation.isPending}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!category) {
            setValidation(`Choose a ${isIncome ? "source" : "category"}.`);
            return;
          }
          if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !date)
            return;
          setValidation("");
          mutation.mutate();
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
              placeholder="0.00"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 rounded-2xl bg-background/40 text-2xl font-semibold tabular-nums md:text-2xl"
            />
          </label>
          <CategoryPicker
            options={options}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setValidation("");
            }}
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
              rows={2}
              maxLength={1000}
              placeholder="Add a note"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="resize-none rounded-xl"
            />
          </label>
        </fieldset>
        {(validation || mutation.error) && (
          <p role="alert" className="text-sm text-destructive">
            {validation || mutation.error?.message}
          </p>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 w-full rounded-xl font-semibold"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}{" "}
          Save {type}
        </Button>
      </form>
    </FormDialog>
  );
}
