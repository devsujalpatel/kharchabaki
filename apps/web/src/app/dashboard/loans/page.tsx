"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  HandCoins,
  Loader2,
  Plus,
  WifiOff,
} from "lucide-react";
import { useOfflineStatus } from "@/components/providers/session-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
type Loan = TakenLoan | GivenLoan;

export default function LoansPage() {
  const queryClient = useQueryClient();
  const offline = useOfflineStatus();
  const { formatMoney } = usePreferences();
  const [kind, setKind] = useState<LoanKind>("taken");
  const [adding, setAdding] = useState(false);
  const taken = useQuery({
    queryKey: ["loans", "taken"],
    queryFn: getTakenLoans,
  });
  const given = useQuery({
    queryKey: ["loans", "given"],
    queryFn: getGivenLoans,
  });
  const query = kind === "taken" ? taken : given;
  const loans: Loan[] = query.data?.data ?? [];
  const canWrite = offline.online && !offline.pending;
  const refresh = () => {
    for (const key of ["loans", "balance", "dashboard-summary"])
      void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const outstanding = loans.reduce(
    (sum, loan) =>
      sum + Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount)),
    0,
  );
  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Loans</h1>
        <Button
          onClick={() => setAdding(true)}
          disabled={!canWrite}
          className="h-10 rounded-xl"
          aria-haspopup="dialog"
        >
          <Plus className="size-4" />
          Add loan
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Loan direction"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1"
      >
        {(["taken", "given"] as const).map((option) => (
          <Button
            key={option}
            id={`loan-tab-${option}`}
            role="tab"
            aria-selected={kind === option}
            aria-controls={`loans-${option}`}
            tabIndex={kind === option ? 0 : -1}
            variant={kind === option ? "default" : "ghost"}
            onClick={() => setKind(option)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "taken"
                  : event.key === "End"
                    ? "given"
                    : kind === "taken"
                      ? "given"
                      : "taken";
              setKind(next);
              document.getElementById(`loan-tab-${next}`)?.focus();
            }}
            className={cn(
              "h-12 rounded-xl text-sm",
              kind === option &&
                "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            {option === "taken" ? (
              <ArrowDownLeft className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
            {option === "taken" ? "I borrowed" : "I lent"}
          </Button>
        ))}
      </div>
      {!canWrite && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="size-3.5 shrink-0" />
          Connect and finish syncing to add or repay loans.
        </p>
      )}
      <section
        role="tabpanel"
        id={`loans-${kind}`}
        aria-labelledby={`loan-tab-${kind}`}
        className="space-y-4"
      >
        <div
          className={cn(
            "rounded-2xl border p-5",
            kind === "taken"
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-emerald-500/20 bg-emerald-500/5",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">
            {kind === "taken" ? "Left to repay" : "Owed to you"}
          </p>
          {query.isPending ? (
            <div className="mt-2 h-8 w-36 animate-pulse rounded bg-muted" />
          ) : (
            <p
              className="mt-1 truncate text-3xl font-semibold tracking-tight tabular-nums"
              title={formatMoney(outstanding)}
            >
              {formatMoney(outstanding)}
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {query.isPending ? (
            <div
              className="space-y-5 p-5"
              role="status"
              aria-label="Loading loans"
            >
              {[0, 1].map((row) => (
                <div key={row} className="space-y-3">
                  <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : query.error ? (
            <div className="p-5">
              <p role="alert" className="text-sm text-destructive">
                {query.error.message}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => query.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : !loans.length ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-muted-foreground">
              <HandCoins className="size-8 opacity-50" />
              <p className="text-sm">
                No {kind === "taken" ? "borrowed" : "lent"} loans yet
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {loans.map((loan) => (
                <LoanRow
                  key={`${kind}-${loan.id}`}
                  kind={kind}
                  loan={loan}
                  onRefresh={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </section>
      {adding && (
        <LoanComposer
          kind={kind}
          onClose={() => setAdding(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

function LoanComposer({
  kind,
  onClose,
  onRefresh,
}: {
  kind: LoanKind;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const offline = useOfflineStatus();
  const [form, setForm] = useState({
    amount: "",
    person: "",
    dueDate: "",
    interest: "0.00",
  });
  const [validation, setValidation] = useState("");
  const mutation = useMutation<Loan>({
    mutationFn: () =>
      kind === "taken"
        ? createTakenLoan({
            amount: form.amount,
            borrowedFrom: form.person.trim(),
            dueDate: form.dueDate,
            interest: form.interest,
          }).then((response) => response.data)
        : createGivenLoan({
            amount: form.amount,
            borrowerName: form.person.trim(),
            dueDate: form.dueDate,
            interest: form.interest,
          }).then((response) => response.data),
    onSuccess: () => {
      onRefresh();
      onClose();
    },
  });
  return (
    <FormDialog
      title={kind === "taken" ? "Borrowed loan" : "Lent loan"}
      icon={kind === "taken" ? ArrowDownLeft : ArrowUpRight}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.person.trim()) {
            setValidation("Enter a name.");
            return;
          }
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
              required
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
              placeholder="0.00"
              className="h-14 rounded-2xl text-2xl font-semibold md:text-2xl"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {kind === "taken" ? "Borrowed from" : "Lent to"}
            </span>
            <Input
              required
              maxLength={100}
              value={form.person}
              onChange={(event) =>
                setForm({ ...form, person: event.target.value })
              }
              placeholder="Name"
              className="h-11 rounded-xl"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium">Due date</span>
              <Input
                type="date"
                required
                value={form.dueDate}
                onChange={(event) =>
                  setForm({ ...form, dueDate: event.target.value })
                }
                className="h-11 rounded-xl"
              />
            </label>
            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium">Interest %</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                value={form.interest}
                onChange={(event) =>
                  setForm({ ...form, interest: event.target.value })
                }
                className="h-11 rounded-xl"
              />
            </label>
          </div>
        </fieldset>
        {(validation || mutation.error) && (
          <p role="alert" className="text-sm text-destructive">
            {validation || mutation.error?.message}
          </p>
        )}
        {(!offline.online || offline.pending > 0) && (
          <p className="text-xs text-muted-foreground">
            Connect and finish syncing to save.
          </p>
        )}
        <Button
          type="submit"
          disabled={
            !offline.online || offline.pending > 0 || mutation.isPending
          }
          className="h-12 w-full rounded-xl font-semibold"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Save loan
        </Button>
      </form>
    </FormDialog>
  );
}

function LoanRow({
  kind,
  loan,
  onRefresh,
}: {
  kind: LoanKind;
  loan: Loan;
  onRefresh: () => void;
}) {
  const offline = useOfflineStatus();
  const { formatMoney } = usePreferences();
  const [paying, setPaying] = useState(false);
  const person = "borrowedFrom" in loan ? loan.borrowedFrom : loan.borrowerName;
  const outstanding = Math.max(
    0,
    Number(loan.totalAmount) - Number(loan.paidAmount),
  );
  const progress =
    Number(loan.totalAmount) > 0
      ? Math.min(
          100,
          (Number(loan.paidAmount) / Number(loan.totalAmount)) * 100,
        )
      : 0;
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            kind === "taken"
              ? "bg-amber-500/10 text-amber-500"
              : "bg-emerald-500/10 text-emerald-500",
          )}
        >
          {kind === "taken" ? (
            <ArrowDownLeft className="size-4" />
          ) : (
            <ArrowUpRight className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={person}>
            {person}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Due {formatDate(loan.dueDate)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize",
            loan.status === "paid"
              ? "bg-emerald-500/10 text-emerald-500"
              : loan.status === "overdue"
                ? "bg-red-500/10 text-red-500"
                : "bg-primary/10 text-primary",
          )}
        >
          {loan.status}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Remaining</p>
          <p
            className="truncate text-xl font-semibold tabular-nums"
            title={formatMoney(outstanding)}
          >
            {formatMoney(outstanding)}
          </p>
        </div>
        {loan.status !== "paid" && (
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-2xl border-primary/20 bg-primary/5 text-primary"
            aria-label={`Record ${kind === "taken" ? "repayment to" : "payment from"} ${person}`}
            title="Record payment"
            aria-haspopup="dialog"
            disabled={!offline.online || offline.pending > 0}
            onClick={() => setPaying(true)}
          >
            <HandCoins className="size-5" />
          </Button>
        )}
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Repayment progress for ${person}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
          Details
          <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total</span>
            <span className="truncate tabular-nums">
              {formatMoney(loan.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Paid</span>
            <span className="truncate tabular-nums">
              {formatMoney(loan.paidAmount)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Interest</span>
            <span>{loan.interest}%</span>
          </div>
          {loan.payments?.length > 0 && (
            <div className="space-y-2 border-t pt-2">
              {loan.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {formatDate(payment.paidAt)}
                  </span>
                  <span className="truncate tabular-nums">
                    {formatMoney(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
      {paying && (
        <PaymentComposer
          key={loan.id}
          kind={kind}
          loan={loan}
          person={person}
          onClose={() => setPaying(false)}
          onRefresh={onRefresh}
        />
      )}
    </article>
  );
}

function PaymentComposer({
  kind,
  loan,
  person,
  onClose,
  onRefresh,
}: {
  kind: LoanKind;
  loan: Loan;
  person: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const offline = useOfflineStatus();
  const { formatMoney } = usePreferences();
  const [amount, setAmount] = useState("");
  const outstanding = Math.max(
    0,
    Number(loan.totalAmount) - Number(loan.paidAmount),
  );
  const mutation = useMutation({
    mutationFn: () =>
      kind === "taken"
        ? recordTakenLoanPayment({ loanId: loan.id, amount })
        : recordGivenLoanPayment({ loanId: loan.id, amount }),
    onSuccess: () => {
      onRefresh();
      onClose();
    },
  });
  return (
    <FormDialog
      title="Record payment"
      icon={HandCoins}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0 || value > outstanding)
            return;
          mutation.mutate();
        }}
      >
        <div className="rounded-2xl bg-muted/40 p-4">
          <p className="truncate text-sm font-semibold" title={person}>
            {person}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Remaining {formatMoney(outstanding)}
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Amount</span>
          <Input
            type="number"
            min="0.01"
            max={outstanding}
            step="0.01"
            inputMode="decimal"
            required
            disabled={mutation.isPending}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="h-14 rounded-2xl text-2xl font-semibold md:text-2xl"
          />
        </label>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <Button
          type="submit"
          disabled={
            !offline.online || offline.pending > 0 || mutation.isPending
          }
          className="h-12 w-full rounded-xl"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Save payment
        </Button>
      </form>
    </FormDialog>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
