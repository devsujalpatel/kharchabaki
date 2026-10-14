import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import {
  AlertTriangle,
  CloudCheck,
  CloudUpload,
  ListFilter,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  WifiOff,
  Smartphone,
} from "lucide-react-native";
import { useOfflineStatus } from "@/lib/session-provider";
import { offlineClient, sessionManager } from "@/lib/offline-client";
import { usePreferences } from "@/lib/preferences";
import { formatLabel } from "@/lib/finance";

export function SyncStatus() {
  const status = useOfflineStatus();
  const { colors, formatMoney } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attention = !!status.error || !!error;
  const Icon = attention
    ? AlertTriangle
    : !status.online
      ? WifiOff
      : status.pending || status.syncing
        ? CloudUpload
        : CloudCheck;
  const title = attention
    ? "Needs attention"
    : status.syncing
      ? "Syncing…"
      : !status.online
        ? "Saved offline"
        : status.pending
          ? `${status.pending} pending`
          : "All synced";
  const iconColor = attention ? "#d97706" : status.online ? colors.primary : colors.subtle;
  async function retry() {
    if (!status.syncEnabled) return;
    try {
      setError(null);
      offlineClient.setOnline(true);
      await sessionManager.refresh();
      if (sessionManager.getSnapshot().data) await offlineClient.flush();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sync. Please retry.");
    }
  }
  if (!status.syncEnabled)
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-card p-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-app-muted">
          <Smartphone size={18} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-app-text">On this device</Text>
          <Text className="mt-0.5 text-xs text-app-subtle">Cloud sync requires Premium.</Text>
        </View>
      </View>
    );
  return (
    <View className="rounded-2xl border border-app-border bg-app-card p-3">
      <View className="flex-row items-center gap-3">
        <View
          className={`h-9 w-9 items-center justify-center rounded-xl ${attention ? "bg-amber-500/10" : "bg-app-muted"}`}
        >
          <Icon size={18} color={iconColor} />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            className="text-sm font-medium text-app-text"
          >
            {title}
          </Text>
          {!status.online && (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-app-subtle">
              On this device{status.pending > 0 ? ` · ${status.pending} pending` : ""}
            </Text>
          )}
        </View>
        {status.pending > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide pending changes" : "Review pending changes"}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            className={`h-11 w-11 items-center justify-center rounded-xl ${expanded ? "bg-app-primary" : "bg-app-muted"}`}
          >
            <ListFilter size={18} color={expanded ? colors.onPrimary : colors.foreground} />
          </Pressable>
        )}
        {(status.pending > 0 || !status.online || attention) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            disabled={status.syncing}
            onPress={retry}
            className={`h-11 w-11 items-center justify-center rounded-xl bg-app-muted ${status.syncing ? "opacity-40" : ""}`}
          >
            <RotateCw size={18} color={colors.foreground} />
          </Pressable>
        )}
      </View>
      {(error || status.error) && (
        <Text accessibilityRole="alert" className="mt-3 text-xs leading-5 text-red-400">
          {error ?? status.error}
        </Text>
      )}
      {expanded && status.pending > 0 && (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={{ maxHeight: 220 }}
          className="mt-3"
          keyboardShouldPersistTaps="handled"
        >
          {offlineClient.getPending().map((change) => {
            const ActionIcon =
              change.method === "POST" ? Plus : change.method === "DELETE" ? Trash2 : Pencil;
            const action =
              change.method === "POST" ? "Add" : change.method === "DELETE" ? "Delete" : "Update";
            const description = `${formatLabel(change.path.split("/")[1])}${change.body.amount ? ` · ${formatMoney(Number(change.body.amount))}` : ""}`;
            return (
              <View
                key={change.id}
                accessibilityLabel={`${action} ${description}`}
                className="flex-row items-center gap-3 border-t border-app-border py-3"
              >
                <ActionIcon size={16} color={colors.subtle} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium text-app-text">
                    {description}
                  </Text>
                  <Text
                    numberOfLines={change.error ? 3 : 1}
                    className={`mt-1 text-xs ${change.error ? "text-red-400" : "text-app-subtle"}`}
                  >
                    {change.error ?? "Waiting to sync"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Discard pending ${action.toLowerCase()} ${description}`}
                  disabled={status.syncing || (change.attempted && !change.error)}
                  onPress={() =>
                    Alert.alert(
                      "Discard change?",
                      "Remove this unsynced change from this device?",
                      [
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
                      ]
                    )
                  }
                  className={`h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 ${status.syncing || (change.attempted && !change.error) ? "opacity-40" : ""}`}
                >
                  <Trash2 size={17} color="#f87171" />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
