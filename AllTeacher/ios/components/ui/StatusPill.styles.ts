import { StyleSheet } from "react-native";

import { radii } from "@/lib/theme";

export const statusPillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
