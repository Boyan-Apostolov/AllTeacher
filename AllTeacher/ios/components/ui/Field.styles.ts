import { StyleSheet } from "react-native";
import { colors, radii } from "@/lib/theme";

export const fieldStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  wrapperFocused: {
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  input: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    padding: 0,
    margin: 0,
  },
  // Legacy compat
  inputFocused: {},
});
