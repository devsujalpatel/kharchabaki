"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sessionManager } from "@/lib/offline-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  LogIn,
  Mail,
  Pencil,
  Smartphone,
  Wallet,
} from "lucide-react";
import {
  useAppSession,
  useOfflineStatus,
} from "@/components/providers/session-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { addBalance, balanceQuery } from "@/server/balance";
import { AppLoading } from "@/components/app-loading";
import { PreferencesSettings } from "@/components/preferences-settings";
import { SyncStatus } from "@/components/sync-status";
import { FormDialog } from "@/components/ui/form-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProfileDashboard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const offline = useOfflineStatus();
  const { formatMoney } = usePreferences();
  const { data: session, isPending: isSessionLoading } = useAppSession();
  const balance = useQuery({ queryKey: ["balance"], queryFn: balanceQuery });
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const mutation = useMutation({
    mutationFn: (value: number) => addBalance(value),
    onSuccess: () => {
      setAmount("");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
  });
  if (isSessionLoading || balance.isPending) return <AppLoading compact />;
  if (!session) return null;
  const user = session.user;
  const canWrite = !offline.syncEnabled || (offline.online && !offline.pending);
  const formattedBalance = formatMoney(balance.data?.data.balance ?? 0);
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <SyncStatus />
      </div>
      <section
        aria-label="Your account"
        className="flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-5"
      >
        <Avatar className="size-16 shrink-0 rounded-2xl">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            {user.name
              .split(" ")
              .map((name) => name[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold" title={user.name}>
            {user.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {session.localOnly ? (
              <Smartphone className="size-3.5 shrink-0" />
            ) : (
              <Mail className="size-3.5 shrink-0" />
            )}
            <span className="truncate" title={user.email}>
              {session.localOnly ? "No account needed" : user.email}
            </span>
          </p>
        </div>
        {session.localOnly && (
          <Button
            variant="outline"
            className="ml-auto h-11 rounded-xl"
            onClick={async () => {
              await sessionManager.expire(null);
              router.replace("/auth/signin");
            }}
          >
            <LogIn className="size-4" />
            Sign in
          </Button>
        )}
      </section>
      <section
        aria-label="Account balance"
        className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wallet className="size-4" />
              Current balance
            </p>
            {balance.error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {balance.error.message}
              </p>
            ) : (
              <p
                className="mt-2 truncate text-3xl font-semibold tracking-tight tabular-nums"
                title={formattedBalance}
              >
                {formattedBalance}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-2xl border-primary/20 bg-card/60 text-primary"
            disabled={!canWrite}
            aria-label="Edit opening balance"
            title="Edit opening balance"
            aria-haspopup="dialog"
            onClick={() => {
              mutation.reset();
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
        {!canWrite && (
          <p className="mt-3 text-xs text-muted-foreground">
            Connect and finish syncing to change your opening balance.
          </p>
        )}
      </section>
      <PreferencesSettings />
      {editing && (
        <FormDialog
          title="Opening balance"
          icon={Wallet}
          onClose={() => setEditing(false)}
          busy={mutation.isPending}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(amount);
              if (
                !amount.trim() ||
                !Number.isFinite(value) ||
                value < 0 ||
                !canWrite
              )
                return;
              mutation.mutate(value);
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium">Amount</span>
              <Input
                type="number"
                min="0"
                max="999999999999.99"
                step="0.01"
                inputMode="decimal"
                required
                disabled={mutation.isPending}
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-14 rounded-2xl text-2xl font-semibold md:text-2xl"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Replaces the balance you started tracking with.
            </p>
            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !canWrite || mutation.isPending || !amount || Number(amount) < 0
              }
              className="h-12 w-full rounded-xl font-semibold"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save balance
            </Button>
          </form>
        </FormDialog>
      )}
    </div>
  );
}
