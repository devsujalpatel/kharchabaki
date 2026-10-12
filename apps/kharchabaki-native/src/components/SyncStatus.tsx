import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { CloudCheck, CloudUpload, WifiOff, AlertTriangle, RotateCw } from "lucide-react-native";
import { useOfflineStatus } from "@/lib/session-provider";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { usePreferences } from "@/lib/preferences";
import { formatLabel } from "@/lib/finance";
export function SyncStatus() {
  const status = useOfflineStatus();
  const { colors, formatMoney } = usePreferences();
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
        ? "Offline · saved on this device"
        : status.pending
          ? `${status.pending} changes waiting to sync`
          : "Everything is up to date";
  async function retry() {
    try {
      setError(null);
      offlineClient.setOnline(true);
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) await offlineClient.flush();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sync. Please retry.");
    }
  }
  return (
    <View className="mx-4 mt-2 rounded-2xl border border-app-border bg-app-card px-3 py-3">
      <View className="flex-row items-center gap-2">
        <Icon
          size={15}
          color={status.error ? "#f59e0b" : status.online ? colors.primary : colors.subtle}
        />
        <Text accessibilityRole="text" className="flex-1 text-xs text-app-subtle">
          {title}
        </Text>
        {status.pending > 0 && (
          <Pressable onPress={() => setExpanded(!expanded)} className="p-2">
            <Text className="text-xs font-medium text-app-text">Review</Text>
          </Pressable>
        )}
        {(status.pending > 0 || !status.online) && (
          <Pressable
            accessibilityLabel="Sync now"
            disabled={status.syncing}
            onPress={retry}
            className="rounded-lg bg-app-muted p-2"
          >
            <RotateCw size={15} color={colors.foreground} />
          </Pressable>
        )}
      </View>
      {(error || status.error) && (
        <Text accessibilityRole="alert" className="mt-2 text-xs text-red-400">
          {error ?? status.error}
        </Text>
      )}
      {expanded && status.pending > 0 && (
        <View className="mt-3 gap-3">
          {offlineClient.getPending().map((change) => (
            <View
              key={change.id}
              className="flex-row items-center gap-3 border-t border-app-border pt-3"
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-app-text">
                  {change.method === "POST"
                    ? "Add"
                    : change.method === "DELETE"
                      ? "Delete"
                      : "Update"}{" "}
                  {formatLabel(change.path.split("/")[1])}
                  {change.body.amount ? ` · ${formatMoney(Number(change.body.amount))}` : ""}
                </Text>
                <Text className="mt-1 text-xs text-app-subtle">
                  {change.error ?? "Waiting to sync"}
                </Text>
              </View>
              <Pressable
                disabled={status.syncing || (change.attempted && !change.error)}
                onPress={() =>
                  Alert.alert("Discard change?", "Remove this unsynced change from this device?", [
                    { text: "Keep", style: "cancel" },
                    {
                      text: "Discard",
                      style: "destructive",
                      onPress: () => {
                        void offlineClient
                          .discard(change.id)
                          .catch((error) => setError(error.message));
                      },
                    },
                  ])
                }
                className="p-2"
              >
                <Text className="text-xs text-red-400">Discard</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
