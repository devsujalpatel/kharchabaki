"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBalance, balanceQuery } from "@/server/balance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

type BalanceForm = {
  amount: number;
};

export default function Balance() {
  const queryClient = useQueryClient();

  const {
    data,
    error,
    isPending: isBalanceLoading,
  } = useQuery({
    queryKey: ["balance"],
    queryFn: balanceQuery,
  });

  const form = useForm<BalanceForm>({
    defaultValues: {
      amount: 0,
    },
  });

  const { mutate, isPending: isAddingBalance } = useMutation({
    mutationFn: addBalance,

    onSuccess: () => {
      form.reset();

      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });
    },
  });

  const handleSubmit = form.handleSubmit(({ amount }) => {
    mutate(amount);
  });

  if (isBalanceLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>{data.message}</h1>
        <p>Balance: ₹{data.data.balance}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-sm gap-2">
        <Input
          type="number"
          placeholder="Enter amount"
          min={0}
          step="0.01"
          disabled={isAddingBalance}
          {...form.register("amount", {
            valueAsNumber: true,
            required: "Amount is required",
            min: {
              value: 1,
              message: "Amount must be greater than 0",
            },
          })}
        />

        <Button type="submit" disabled={isAddingBalance}>
          {isAddingBalance ? "Adding..." : "Add"}
        </Button>
      </form>

      {form.formState.errors.amount && (
        <p className="text-sm text-destructive">
          {form.formState.errors.amount.message}
        </p>
      )}
    </div>
  );
}
