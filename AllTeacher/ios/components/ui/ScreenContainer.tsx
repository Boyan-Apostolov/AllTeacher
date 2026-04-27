/**
 * Standard screen scaffold: a solid bg, an optional gradient that bleeds
 * from the top, and a SafeAreaView for content. Every full-screen page
 * mounts this so we don't repeat the gradient + safe-area dance in five
 * different files.
 */
import type { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Gradient } from "@/components/Gradient";
import { colors } from "@/lib/theme";
import { screenContainerStyles as styles } from "./ScreenContainer.styles";

type GradientProps = {
  from: string;
  via?: string;
  to: string;
  angle?: number;
  height?: number;
};

export function ScreenContainer({
  gradient,
  children,
  edges = ["top", "bottom"],
  contentStyle,
}: {
  gradient?: GradientProps;
  children: ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
  contentStyle?: ViewStyle;
}) {
  return (
    <View style={styles.root}>
      {gradient ? (
        <Gradient
          from={gradient.from}
          via={gradient.via}
          to={gradient.to}
          angle={gradient.angle ?? 150}
          style={[styles.bgGradient, { height: gradient.height ?? 320 }]}
        />
      ) : null}
      <SafeAreaView
        style={[styles.safe, contentStyle]}
        edges={edges as any}
      >
        {children}
      </SafeAreaView>
    </View>
  );
}

export const screenBg = colors.bg;
