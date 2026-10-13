import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function KeyboardScroll({
  children,
  onFocus,
  onLayout,
  onScroll,
  ...props
}: ScrollViewProps & { children: ReactNode }) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealInput = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const scrollView = scroll.current;
      const viewport = scrollView?.getNativeScrollRef();
      const input = TextInput.State.currentlyFocusedInput();
      // A screen behind a modal must never scroll or measure that modal's input.
      if (!scrollView || !viewport || !input || !viewport.contains(input)) return;
      viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        if (!viewportHeight || scroll.current !== scrollView) return;
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (scroll.current !== scrollView || TextInput.State.currentlyFocusedInput() !== input)
            return;
          // Use the actual scroll viewport: a sheet has a header and a fixed footer.
          const keyboardTop = Keyboard.metrics()?.screenY ?? Number.POSITIVE_INFINITY;
          const visibleBottom = Math.min(viewportTop + viewportHeight, keyboardTop) - 24;
          const overflow = inputTop + inputHeight - visibleBottom;
          if (overflow > 0)
            scrollView.scrollTo({ y: Math.max(0, offset.current + overflow), animated: true });
          else if (inputTop < viewportTop + 12)
            scrollView.scrollTo({
              y: Math.max(0, offset.current + inputTop - viewportTop - 12),
              animated: true,
            });
        });
      });
    }, 120);
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", revealInput);
    const changed = Keyboard.addListener("keyboardDidChangeFrame", revealInput);
    return () => {
      shown.remove();
      changed.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [revealInput]);
  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      {...props}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      onLayout={(event) => {
        onLayout?.(event);
        if (Keyboard.isVisible()) revealInput();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        revealInput();
      }}
    >
      {children}
    </ScrollView>
  );
}

export function KeyboardScreen({
  children,
  contentContainerClassName = "px-4 pt-6 pb-8",
  ...props
}: ScrollViewProps & { children: ReactNode; contentContainerClassName?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <KeyboardScroll
        className="flex-1"
        contentContainerClassName={contentContainerClassName}
        {...props}
      >
        {children}
      </KeyboardScroll>
    </KeyboardAvoidingView>
  );
}
