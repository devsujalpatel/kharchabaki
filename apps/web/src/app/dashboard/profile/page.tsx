"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { addBalance, balanceQuery } from "@/server/balance";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function ProfileDashboard() {
  const queryClient = useQueryClient();

  const { data: session, isPending: isSessionLoading } =
    authClient.useSession();

  const {
    data: balanceData,
    isPending: isBalanceLoading,
    error: balanceError,
  } = useQuery({
    queryKey: ["balance"],
    queryFn: balanceQuery,
  });

  const [amount, setAmount] = useState("");

  const { mutate: updateBalance, isPending: isUpdatingBalance } = useMutation({
    mutationFn: (amount: number) => addBalance(amount),

    onSuccess: () => {
      setAmount("");

      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });
    },
  });

  if (isSessionLoading || isBalanceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>You are not authenticated.</p>
      </div>
    );
  }

  const user = session.user;
  console.log(user.image);

  const handleBalanceSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = Number(amount);

    if (!value || value < 0) {
      return;
    }

    updateBalance(value);
  };

  return (
    <main className="mx-auto w-full max-w-4xl p-2 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

        <p className="text-sm text-muted-foreground">
          Manage your profile and account balance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>
              Your account information from authentication.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={user?.image ?? undefined} alt={user.name} />

                <AvatarFallback>
                  {user.name
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="font-medium">{user.name}</h2>

                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>

                <p className="font-medium">{user.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Email</p>

                <p className="font-medium">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card className="mb-15 sm:mb-0">
          <CardHeader>
            <CardTitle>Balance</CardTitle>

            <CardDescription>
              Set the amount you already have before tracking transactions.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Current balance</p>

              {balanceError ? (
                <p className="mt-1 text-sm text-destructive">
                  Failed to load balance.
                </p>
              ) : (
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  ₹{balanceData?.data.balance.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <Separator />

            <form onSubmit={handleBalanceSubmit} className="space-y-3">
              <div>
                <label htmlFor="balance" className="text-sm font-medium">
                  Opening balance
                </label>

                <p className="mb-2 text-xs text-muted-foreground">
                  This will replace your current opening balance.
                </p>

                <Input
                  id="balance"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="25000"
                  value={amount}
                  disabled={isUpdatingBalance}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={isUpdatingBalance || !amount || Number(amount) < 0}
                className="w-full"
                variant={"primary"}
              >
                {isUpdatingBalance ? "Updating..." : "Update balance"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
