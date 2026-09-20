"use client";

import { SubmitEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGivenLoan,
  createTakenLoan,
  getGivenLoans,
  getTakenLoans,
  recordGivenLoanPayment,
  recordTakenLoanPayment,
  type GivenLoan,
  type TakenLoan,
} from "@/server/loan";

type LoanKind = "taken" | "given";

const initialForm = {
  amount: "",
  person: "",
  dueDate: "",
  interest: "0.00",
};

export default function LoansPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<LoanKind>("taken");
  const [form, setForm] = useState(initialForm);

  const takenLoansQuery = useQuery({
    queryKey: ["loans", "taken"],
    queryFn: getTakenLoans,
  });
  const givenLoansQuery = useQuery({
    queryKey: ["loans", "given"],
    queryFn: getGivenLoans,
  });

  const refreshLoans = () => {
    void queryClient.invalidateQueries({ queryKey: ["loans"] });
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const createMutation = useMutation<TakenLoan | GivenLoan>({
    mutationFn: () =>
      kind === "taken"
        ? createTakenLoan({
            amount: form.amount,
            borrowedFrom: form.person,
            dueDate: form.dueDate,
            interest: form.interest,
          }).then((response) => response.data)
        : createGivenLoan({
            amount: form.amount,
            borrowerName: form.person,
            dueDate: form.dueDate,
            interest: form.interest,
          }).then((response) => response.data),
    onSuccess: () => {
      setForm(initialForm);
      refreshLoans();
    },
  });

  const submitLoan = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const takenLoans = takenLoansQuery.data?.data ?? [];
  const givenLoans = givenLoansQuery.data?.data ?? [];
  const isLoading = takenLoansQuery.isPending || givenLoansQuery.isPending;
  const hasError = takenLoansQuery.isError || givenLoansQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Loans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track money you borrow and lend, including repayments.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add a loan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <Button
              type="button"
              variant={kind === "taken" ? "secondary" : "ghost"}
              onClick={() => setKind("taken")}
            >
              I borrowed money
            </Button>
            <Button
              type="button"
              variant={kind === "given" ? "secondary" : "ghost"}
              onClick={() => setKind("given")}
            >
              I lent money
            </Button>
          </div>

          <form
            onSubmit={submitLoan}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Amount" id="loan-amount">
              <Input
                id="loan-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                placeholder="5000"
              />
            </Field>
            <Field
              label={kind === "taken" ? "Borrowed from" : "Borrower name"}
              id="loan-person"
            >
              <Input
                id="loan-person"
                required
                maxLength={100}
                value={form.person}
                onChange={(event) =>
                  setForm({ ...form, person: event.target.value })
                }
                placeholder={
                  kind === "taken" ? "Bank or person" : "Person's name"
                }
              />
            </Field>
            <Field label="Due date" id="loan-due-date">
              <Input
                id="loan-due-date"
                type="date"
                required
                value={form.dueDate}
                onChange={(event) =>
                  setForm({ ...form, dueDate: event.target.value })
                }
              />
            </Field>
            <Field label="Interest (%)" id="loan-interest">
              <Input
                id="loan-interest"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.interest}
                onChange={(event) =>
                  setForm({ ...form, interest: event.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Add {kind === "taken" ? "borrowed" : "given"} loan
              </Button>
              {createMutation.isError && (
                <p className="mt-2 text-sm text-destructive">
                  Unable to create the loan. Please check the details and try
                  again.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {hasError ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-sm text-destructive">
            Failed to load loans.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading loans…
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 mb-20 sm:mb-0">
          <LoanList kind="taken" loans={takenLoans} onRefresh={refreshLoans} />
          <LoanList kind="given" loans={givenLoans} onRefresh={refreshLoans} />
        </div>
      )}
    </div>
  );
}

function LoanList({
  kind,
  loans,
  onRefresh,
}: {
  kind: LoanKind;
  loans: TakenLoan[] | GivenLoan[];
  onRefresh: () => void;
}) {
  const isTaken = kind === "taken";

  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            className={
              isTaken
                ? "rounded-lg bg-amber-500/10 p-2 text-amber-600"
                : "rounded-lg bg-emerald-500/10 p-2 text-emerald-600"
            }
          >
            {isTaken ? (
              <ArrowDownLeft className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
          </span>
          {isTaken ? "Money borrowed" : "Money lent"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loans.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <HandCoins className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No {isTaken ? "borrowed" : "given"} loans yet.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {loans.map((loan) => (
              <LoanRow
                key={loan.id}
                kind={kind}
                loan={loan}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoanRow({
  kind,
  loan,
  onRefresh,
}: {
  kind: LoanKind;
  loan: TakenLoan | GivenLoan;
  onRefresh: () => void;
}) {
  const [amount, setAmount] = useState("");
  const isTaken = kind === "taken";
  const person = "borrowedFrom" in loan ? loan.borrowedFrom : loan.borrowerName;
  const outstanding = Number(loan.totalAmount) - Number(loan.paidAmount);
  const paymentMutation = useMutation({
    mutationFn: () =>
      isTaken
        ? recordTakenLoanPayment({ loanId: loan.id, amount })
        : recordGivenLoanPayment({ loanId: loan.id, amount }),
    onSuccess: () => {
      setAmount("");
      onRefresh();
    },
  });

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{person}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Due {formatDate(loan.dueDate)} · {loan.interest}% interest
          </p>
        </div>
        <span
          className={
            loan.status === "paid"
              ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700"
              : "rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700"
          }
        >
          {loan.status}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-semibold">{formatMoney(outstanding)}</p>
          <p className="text-xs text-muted-foreground">
            of {formatMoney(Number(loan.totalAmount))}
          </p>
        </div>
        {loan.status !== "paid" && (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              paymentMutation.mutate();
            }}
          >
            <Input
              aria-label="Payment amount"
              type="number"
              min="0.01"
              max={outstanding}
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-28"
              placeholder="Payment"
            />
            <Button
              type="submit"
              size="sm"
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Record"
              )}
            </Button>
          </form>
        )}
      </div>
      {paymentMutation.isError && (
        <p className="mt-2 text-xs text-destructive">
          Unable to record payment.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
