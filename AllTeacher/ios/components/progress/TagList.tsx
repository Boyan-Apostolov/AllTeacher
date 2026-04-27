/**
 * Top weak areas / strengths list. Same layout, accent colour and emoji
 * are passed in.
 *
 * The dashboard renders one of each (red flame for weak areas, green
 * sparkles for strengths) so a shared component keeps the styling tight.
 */
import { Text, View } from "react-native";

import type { TagStat } from "@/lib/api";
import { colors } from "@/lib/theme";

import { tagListStyles as styles } from "./TagList.styles";

export type TagListVariant = "weak" | "strength";

const VARIANT = {
  weak: {
    emoji: "🎯",
    title: "Focus areas",
    fg: "#a16207",
    bg: colors.warningSoft,
    empty: "Nothing flagged yet — keep going.",
  },
  strength: {
    emoji: "✨",
    title: "Strengths",
    fg: "#15803d",
    bg: colors.successSoft,
    empty: "We'll surface strengths once you've nailed a few exercises.",
  },
} as const;

export function TagList({
  variant,
  tags,
  title,
  emptyText,
}: {
  variant: TagListVariant;
  tags: TagStat[];
  title?: string;
  emptyText?: string;
}) {
  const v = VARIANT[variant];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title ?? v.title}</Text>
        <Text style={styles.emoji}>{v.emoji}</Text>
      </View>
      {tags.length === 0 ? (
        <Text style={styles.empty}>{emptyText ?? v.empty}</Text>
      ) : (
        tags.map((t, idx) => (
          <View key={`${t.tag}-${idx}`} style={styles.row}>
            <Text style={styles.rank}>{idx + 1}.</Text>
            <Text style={styles.tag} numberOfLines={2}>
              {t.tag}
            </Text>
            <Text style={[styles.count, { backgroundColor: v.bg, color: v.fg }]}>
              {t.count}×
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
