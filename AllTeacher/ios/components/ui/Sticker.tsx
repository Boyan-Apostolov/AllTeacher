/**
 * Sticker — angled neo-brutalist tag label. Used throughout the app for
 * eyebrow labels, step indicators, category tags etc.
 */
import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

interface StickerProps {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  rotate?: number;
  style?: ViewStyle;
  textStyle?: object;
  uppercase?: boolean;
}

export function Sticker({
  children,
  bg = colors.brand,
  color = "#fff",
  rotate = -3,
  style,
  textStyle,
  uppercase = true,
}: StickerProps) {
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: 11,
          paddingVertical: 5,
          backgroundColor: bg,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.ink,
          transform: [{ rotate: `${rotate}deg` }],
          // Hard offset shadow (neo-brutalist)
          shadowColor: colors.ink,
          shadowOpacity: 1,
          shadowRadius: 0,
          shadowOffset: { width: 2, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            color,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 0.6,
            textTransform: uppercase ? "uppercase" : "none",
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
