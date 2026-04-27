import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const messageBoxStyles = StyleSheet.create({
  box: {
    padding: spacing.md,
    borderRadius: radii.md,
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },

  // error
  errorBox: { backgroundColor: colors.dangerSoft },
  errorTitle: { color: colors.danger },
  errorText: { color: colors.danger },

  // info
  infoBox: { backgroundColor: colors.infoSoft },
  infoTitle: { color: colors.info },
  infoText: { color: colors.info },

  // success
  successBox: { backgroundColor: colors.successSoft },
  successTitle: { color: colors.success },
  successText: { color: colors.success },

  // warning
  warningBox: { backgroundColor: colors.warningSoft },
  warningTitle: { color: colors.warning },
  warningText: { color: colors.warning },
});
