"use client";
import { useState } from "react";
import {
  CloudCheck,
  CloudUpload,
  WifiOff,
  AlertTriangle,
  ChevronDown,
  RotateCw,
} from "lucide-react";
import { useOfflineStatus } from "@/components/providers/session-provider";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { formatLabel } from "@/lib/finance";
import { Button } from "@/components/ui/button";
export function SyncStatus() {
  const status = useOfflineStatus();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = status.error
    ? AlertTriangle
    : !status.online
      ? WifiOff
      : status.pending
        ? CloudUpload
        : CloudCheck;
  const title = status.error
    ? "A change needs your attention"
    : status.syncing
      ? "Syncing your changes…"
      : !status.online
        ? "You're offline. Your changes stay saved here."
        : status.pending
          ? `${status.pending} changes saved on this device`
          : "Everything is up to date";
  async function retry() {
    try {
      setError(null);
      offlineClient.setOnline(true);
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) await offlineClient.flush();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not sync. Please retry.",
      );
    }
  }
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${status.error ? "border-amber-500/30 bg-amber-500/5" : "border-border/70 bg-card/70"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Icon
          className={`size-4 shrink-0 ${status.error ? "text-amber-500" : status.online ? "text-primary" : "text-muted-foreground"}`}
        />
        <p role="status" className="flex-1 text-xs font-medium">
          {title}
        </p>
        {status.pending > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            Review <ChevronDown className="size-3" />
          </Button>
        )}
        {(status.pending > 0 || !status.online) && (
          <Button
            size="sm"
            variant="outline"
            disabled={status.syncing}
            onClick={retry}
          >
            <RotateCw
              className={`size-3 ${status.syncing ? "animate-spin" : ""}`}
            />
            {status.syncing ? "Syncing" : "Sync now"}
          </Button>
        )}
        {!status.pending && status.online && status.lastSyncedAt && (
          <span className="text-[11px] text-muted-foreground">
            Saved{" "}
            {new Date(status.lastSyncedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      {(error || status.error) && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error ?? status.error}
        </p>
      )}
      {expanded && status.pending > 0 && (
        <div className="mt-3 divide-y border-t">
          {offlineClient.getPending().map((change) => (
            <div
              key={change.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {change.method === "POST"
                    ? "Add"
                    : change.method === "DELETE"
                      ? "Delete"
                      : "Update"}{" "}
                  {formatLabel(change.path.split("/")[1])}
                  {change.body.amount ? ` · ${change.body.amount}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {change.error ?? "Waiting to sync"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={status.syncing || (change.attempted && !change.error)}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Discard this unsynced change from this device?",
                    )
                  )
                    return;
                  try {
                    await offlineClient.discard(change.id);
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Could not discard change.",
                    );
                  }
                }}
              >
                Discard
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
