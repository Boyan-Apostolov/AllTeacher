/**
 * BrutalCard — white card with chunky ink border + offset shadow.
 * The standard card primitive in the neo-brutalist design.
 */
import React from "react";
import { View, ViewStyle } from "react-native";
import { colors, radii } from "@/lib/theme";

interface BrutalCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  bg?: string;
  radius?: number;
  borderWidth?: number;
  shadowOffset?: number;
  shadowColor?: string;
}

export function BrutalCard({
  children,
  style,
  bg = colors.card,
  radius = radii.lg,
  borderWidth = 2,
  shadowOffset = 4,
  shadowColor = colors.ink,
}: BrutalCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius,
          borderWidth,
          borderColor: colors.ink,
          shadowColor,
          shadowOpacity: 1,
          shadowRadius: 0,
          shadowOffset: { width: shadowOffset, height: shadowOffset },
          elevation: shadowOffset,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
