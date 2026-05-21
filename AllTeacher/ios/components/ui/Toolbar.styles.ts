import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const toolbarStyles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  btnText: {
    fontSize: 14,
    color: colors.textOnDark,
    fontWeight: "700",
  },
  btnSpacer: {
    // Keeps the title centered when only one of {back, home} is present.
    minWidth: 64,
  },
  title: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  middle: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
});
