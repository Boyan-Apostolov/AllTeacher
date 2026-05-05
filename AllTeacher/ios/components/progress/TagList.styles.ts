import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const tagListStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  emoji: { fontSize: 18 },
  title: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.ink,
  },
  empty: {
    fontSize: 13,
    color: colors.ink3,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(26,20,16,0.08)",
  },
  rank: { width: 22, fontSize: 12, fontWeight: "900", color: colors.ink4 },
  tag: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "600" },
  count: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
});
