import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const toolbarStyles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 2,
  },
  btnPressed: {
    shadowOffset: { width: 0, height: 0 },
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  btnIcon: {
    fontSize: 20,
    color: colors.ink,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
  },
  btnSpacer: {
    width: 40,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginHorizontal: spacing.sm,
  },
  middle: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
});
