"use client";
import { useState } from "react";
import { ArrowRight, ShieldCheck, CloudUpload, Loader2 } from "lucide-react";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { authClient } from "@/lib/auth-client";
import {
  useAppSession,
  useOfflineStatus,
} from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const session = useAppSession();
  const offline = useOfflineStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function login() {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
        errorCallbackURL: `${window.location.origin}/auth/signin`,
      });
      if (result.error)
        setError(
          result.error.message ?? "Could not sign in. Please try again.",
        );
    } catch {
      setError("Could not connect to Google. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-3xl border bg-card p-7 shadow-xl shadow-black/5 sm:p-9",
        className,
      )}
      {...props}
    >
      <span className="mb-5 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        Your everyday money companion
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        One place for your spending, income, and a clearer picture of what comes
        next.
      </p>
      {session.reason === "expired" && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm"
        >
          Your session expired. Sign in again to continue. Unsynced changes are
          still saved on this device.
        </p>
      )}
      {!offline.online && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Connect to the internet to sign in.
          <button
            className="ml-2 underline underline-offset-4"
            onClick={() => {
              offlineClient.setOnline(navigator.onLine);
              void sessionManager.refresh(true);
            }}
          >
            Retry connection
          </button>
        </p>
      )}
      <Button
        className="mt-7 h-12 w-full rounded-xl"
        disabled={loading || !offline.online}
        onClick={login}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.2h5.4c-.3 1.3-1 2.3-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.5ZM12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.6A10 10 0 0 0 12 22ZM6.3 14a6 6 0 0 1 0-4V7.4H2.9a10 10 0 0 0 0 9.2L6.3 14ZM12 5.8c1.5 0 2.8.5 3.8 1.5L18.6 4A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.4L6.3 10c.8-2.4 3.1-4.2 5.7-4.2Z"
            />
          </svg>
        )}
        {loading ? "Opening Google…" : "Continue with Google"}
        <ArrowRight className="ml-auto size-4" />
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-7 space-y-3 border-t pt-5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <CloudUpload className="size-4 text-primary" />
          Save offline. Sync when you&apos;re connected.
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Your history stays linked to your account.
        </p>
      </div>
    </div>
  );
}
