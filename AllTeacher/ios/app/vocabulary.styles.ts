import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const vocabStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 48,
  },

  // ── Hero ───────────────────────────────────────────────────
  heroBlock: { gap: spacing.xs },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.ink3,
    lineHeight: 20,
  },

  // ── Search ─────────────────────────────────────────────────
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: "600",
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 18,
    color: colors.ink3,
    paddingLeft: 4,
  },

  // ── Filter tabs ────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.ink,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  filterTabTextActive: {
    color: colors.paper,
  },

  // ── Stats strip ────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Section label ──────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: -4,
  },

  // ── Word cards ─────────────────────────────────────────────
  wordList: { gap: spacing.sm },
  wordCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  wordCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  wordEmoji: {
    fontSize: 26,
    lineHeight: 32,
    width: 36,
    textAlign: "center",
  },
  wordBody: { flex: 1, gap: 3 },
  wordTarget: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  wordNative: {
    fontSize: 14,
    color: colors.ink3,
    fontWeight: "500",
  },
  wordExample: {
    fontSize: 12,
    color: colors.ink3,
    fontStyle: "italic",
    lineHeight: 17,
    marginTop: 2,
  },

  // Badges
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Mastery bar
  masteryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 8,
  },
  masteryTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.paperAlt,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.ink4,
    overflow: "hidden",
  },
  masteryFill: {
    height: "100%",
    borderRadius: 3,
  },
  masteryPct: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink3,
    minWidth: 36,
    textAlign: "right",
  },

  // Word action buttons
  wordActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(26,20,16,0.08)",
  },
  wordBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 2,
  },
  wordBtnPrimary: { backgroundColor: colors.flash },
  wordBtnSecondary: { backgroundColor: colors.card },
  wordBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
  },

  // ── Add word CTA ───────────────────────────────────────────
  addWordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  addWordText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
  },

  // ── Practice all banner ────────────────────────────────────
  practiceBanner: {
    backgroundColor: colors.mcSoft,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  practiceBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  practiceBannerEmoji: { fontSize: 24 },
  practiceBannerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
  },
  practiceBannerSub: { fontSize: 13, color: colors.ink3 },
  practiceAllBtn: {
    backgroundColor: colors.mc,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  practiceAllText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },

  // ── Empty state ────────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.ink,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: colors.ink3,
    textAlign: "center",
    lineHeight: 19,
  },
});
