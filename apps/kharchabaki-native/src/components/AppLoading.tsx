import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Wallet } from "lucide-react-native";
export function AppLoading() {
  const [pulse] = useState(() => new Animated.Value(0.35));
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Opening your dashboard"
      className="flex-1 items-center justify-center bg-[#090b09]"
    >
      <Animated.View
        style={{ opacity: pulse }}
        className="mb-7 h-24 w-24 items-center justify-center rounded-[28px] border border-[#cbff3d]/30 bg-[#cbff3d]/10"
      >
        <Wallet size={42} color="#cbff3d" strokeWidth={1.6} />
      </Animated.View>
      <Text className="text-2xl font-semibold tracking-tight text-white">kharchabaki</Text>
      <Text className="mt-3 text-sm text-zinc-400">A little clarity for your money.</Text>
      <View className="mt-8 flex-row items-end gap-2">
        {[12, 20, 28, 18, 24].map((height, index) => (
          <Animated.View
            key={index}
            style={{ height, opacity: pulse }}
            className="w-1.5 rounded-full bg-[#cbff3d]"
          />
        ))}
      </View>
    </View>
  );
}
