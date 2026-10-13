import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreferences } from "@/lib/preferences";
import { KeyboardScroll } from "@/components/KeyboardScreen";

type SheetPanel = { title: string; content: ReactNode };
const PanelContext = createContext<((panel: SheetPanel | null) => void) | null>(null);
export function useSheetPanel() {
  return useContext(PanelContext);
}
type FormSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
};
export function FormSheet(props: FormSheetProps) {
  return props.visible ? <SheetContent {...props} /> : null;
}
function SheetContent({ title, onClose, children, footer, disabled }: FormSheetProps) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [panel, setPanel] = useState<SheetPanel | null>(null);
  function close() {
    if (disabled) return;
    Keyboard.dismiss();
    if (panel) setPanel(null);
    else onClose();
  }
  function showPanel(next: SheetPanel | null) {
    Keyboard.dismiss();
    setPanel(next);
  }
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={panel ? "Back to form" : `Close ${title}`}
          disabled={disabled}
          onPress={close}
          className="absolute inset-0 bg-black/60"
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          className="flex-1 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            accessibilityViewIsModal
            className="overflow-hidden rounded-t-[28px] border border-app-border bg-app-card"
            style={{ maxHeight: height - insets.top - 20, flexShrink: 1 }}
          >
            <View className="items-center pt-3">
              <View className="h-1 w-10 rounded-full bg-app-border" />
            </View>
            <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
              {panel && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to form"
                  onPress={close}
                  className="h-11 w-11 items-center justify-center rounded-full bg-app-muted"
                >
                  <ArrowLeft size={20} color={colors.foreground} />
                </Pressable>
              )}
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                className="min-w-0 flex-1 text-lg font-semibold text-app-text"
              >
                {panel?.title ?? title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={panel ? "Close selection" : `Close ${title}`}
                disabled={disabled}
                onPress={close}
                className="h-11 w-11 items-center justify-center rounded-full bg-app-muted"
              >
                <X size={19} color={colors.subtle} />
              </Pressable>
            </View>
            <PanelContext.Provider value={showPanel}>
              <KeyboardScroll
                key={panel ? "selection" : "form"}
                style={{ flexShrink: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: footer && !panel ? 16 : Math.max(insets.bottom, 16) + 12,
                }}
              >
                {panel?.content ?? children}
              </KeyboardScroll>
            </PanelContext.Provider>
            {!panel && footer && (
              <View
                className="border-t border-app-border px-5 pt-3"
                style={{ paddingBottom: Math.max(insets.bottom, 12) }}
              >
                {footer}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
