import { StyleSheet } from "react-native";

import { radii } from "@/lib/theme";

export const diagPillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  icon: { fontSize: 11 },
  text: { fontSize: 12, fontWeight: "700" },
});
