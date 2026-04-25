/**
 * Gradient — small wrapper around expo-linear-gradient that falls back to a
 * solid View if the package isn't installed yet.
 *
 * This keeps the app runnable before the user runs `npm install`.
 */
import { View, type ViewStyle } from "react-native";

type LinearGradientModule = {
  LinearGradient: React.ComponentType<{
    colors: readonly string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    style?: ViewStyle | ViewStyle[];
    children?: React.ReactNode;
  }>;
};

let LinearGradientImpl: LinearGradientModule["LinearGradient"] | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradientImpl = (require("expo-linear-gradient") as LinearGradientModule)
    .LinearGradient;
} catch {
  LinearGradientImpl = null;
}

export function Gradient({
  from,
  to,
  via,
  angle = 135,
  style,
  children,
}: {
  from: string;
  to: string;
  via?: string;
  angle?: number;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}) {
  const colors = via ? [from, via, to] : [from, to];

  // Convert a CSS-style angle (deg) to {x,y} start/end points on the unit
  // square. 0deg = bottom→top, 90deg = left→right (CSS convention).
  const rad = (angle * Math.PI) / 180;
  const start = {
    x: 0.5 - Math.sin(rad) / 2,
    y: 0.5 + Math.cos(rad) / 2,
  };
  const end = {
    x: 0.5 + Math.sin(rad) / 2,
    y: 0.5 - Math.cos(rad) / 2,
  };

  if (LinearGradientImpl) {
    const G = LinearGradientImpl;
    return (
      <G colors={colors} start={start} end={end} style={style}>
        {children}
      </G>
    );
  }

  // Fallback: blend approximation as solid color (use the deeper end).
  return (
    <View style={[{ backgroundColor: to }, style]}>
      {children}
    </View>
  );
}
