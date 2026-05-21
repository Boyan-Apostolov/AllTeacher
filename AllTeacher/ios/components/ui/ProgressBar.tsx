/**
 * Slim progress bar — track + fill. The "Up next" hero, the home list
 * row, and the in-session top toolbar all rendered their own version of
 * this. Now they all use the same component.
 */
import { View, ViewStyle } from "react-native";

import { colors } from "@/lib/theme";

import { progressBarStyles as styles } from "./ProgressBar.styles";

export function ProgressBar({
  pct,
  color,
  trackColor,
  height,
  style,
}: {
  pct: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View
      style={[
        styles.track,
        height ? { height, borderRadius: height / 2 } : null,
        trackColor ? { backgroundColor: trackColor } : null,
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%` as any },
          { backgroundColor: color ?? colors.brand },
          height ? { borderRadius: height / 2 } : null,
        ]}
      />
    </View>
  );
}
