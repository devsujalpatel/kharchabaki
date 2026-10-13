"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CloudCheck,
  CloudUpload,
  Loader2,
  RotateCw,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useOfflineStatus } from "@/components/providers/session-provider";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { formatLabel } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";

export function SyncStatus() {
  const status = useOfflineStatus();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon =
    status.error || error
      ? AlertTriangle
      : status.syncing
        ? Loader2
        : !status.online
          ? WifiOff
          : status.pending
            ? CloudUpload
            : CloudCheck;
  const title =
    status.error || error
      ? "Needs review"
      : status.syncing
        ? "Syncing"
        : !status.online
          ? "Offline"
          : status.pending
            ? `${status.pending} pending`
            : "Synced";
  const savedAt = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  async function retry() {
    try {
      setError(null);
      offlineClient.setOnline(true);
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) await offlineClient.flush();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not sync. Please retry.",
      );
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        aria-label={`${title}. View sync status`}
        title={savedAt ? `${title} · Saved ${savedAt}` : title}
        aria-haspopup="dialog"
        onClick={() => setExpanded(true)}
        className={cn(
          "h-9 shrink-0 gap-2 rounded-full border px-3 text-xs",
          status.error || error
            ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
            : !status.online
              ? "border-border bg-muted/50 text-muted-foreground"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
        )}
      >
        <Icon className={cn("size-3.5", status.syncing && "animate-spin")} />
        <span role="status">{title}</span>
      </Button>
      {expanded && (
        <FormDialog
          title="Sync status"
          icon={Icon}
          onClose={() => setExpanded(false)}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {!status.online
                  ? "Your changes are saved on this device."
                  : status.pending
                    ? "Changes sync when you're connected."
                    : savedAt
                      ? `Everything is up to date · ${savedAt}`
                      : "Everything is up to date"}
              </p>
            </div>
            {(error || status.error) && (
              <p role="alert" className="text-xs text-destructive">
                {error ?? status.error}
              </p>
            )}
            {status.pending > 0 && (
              <div className="divide-y rounded-2xl border px-3">
                {offlineClient.getPending().map((change) => (
                  <div
                    key={change.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {change.method === "POST"
                          ? "Add"
                          : change.method === "DELETE"
                            ? "Delete"
                            : "Update"}{" "}
                        {formatLabel(change.path.split("/")[1])}
                        {change.body.amount ? ` · ${change.body.amount}` : ""}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {change.error ?? "Waiting to sync"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                      aria-label="Discard unsynced change"
                      title="Discard"
                      disabled={
                        status.syncing || (change.attempted && !change.error)
                      }
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Discard this unsynced change from this device?",
                          )
                        )
                          return;
                        try {
                          await offlineClient.discard(change.id);
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not discard change.",
                          );
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {(status.pending > 0 ||
              !status.online ||
              status.error ||
              error) && (
              <Button
                className="h-11 w-full rounded-xl"
                disabled={status.syncing}
                onClick={retry}
              >
                <RotateCw
                  className={cn("size-4", status.syncing && "animate-spin")}
                />
                {status.syncing ? "Syncing" : "Sync now"}
              </Button>
            )}
          </div>
        </FormDialog>
      )}
    </>
  );
}
