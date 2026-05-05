/**
 * Spark — decorative 8-pointed starburst SVG. Used as accent decoration.
 */
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@/lib/theme";

let Svg: any, Path: any;
try {
  const rnsvg = require("react-native-svg");
  Svg = rnsvg.Svg;
  Path = rnsvg.Path;
} catch (_) {}

interface SparkProps {
  size?: number;
  color?: string;
}

export function Spark({ size = 16, color = colors.brand }: SparkProps) {
  if (!Svg) {
    return <Text style={{ fontSize: size * 0.8, color }}>✦</Text>;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z"
        fill={color}
        stroke={colors.ink}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
