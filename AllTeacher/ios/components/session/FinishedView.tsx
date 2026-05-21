/**
 * Session-complete view. Shows the average evaluated score, a celebratory
 * line keyed to that score, and a CTA back to home.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";

import type { ExerciseRow } from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

import { finishedViewStyles as styles } from "./FinishedView.styles";

function cheerFor(pct: number): string {
  if (pct >= 90) return "Outstanding! 🌟";
  if (pct >= 75) return "Strong work! 🎉";
  if (pct >= 50) return "Solid progress 💪";
  return "Every rep counts 🌱";
}

export function FinishedView({
  exercises,
  onHome,
}: {
  exercises: ExerciseRow[];
  onHome: () => void;
}) {
  const evaluated = exercises.filter((e) => e.status === "evaluated");
  const avg = useMemo(
    () =>
      evaluated.length > 0
        ? evaluated.reduce((acc, e) => acc + (e.score ?? 0), 0) /
          evaluated.length
        : 0,
    [evaluated],
  );
  const pct = Math.round(avg * 100);
  const cheer = cheerFor(pct);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Session complete</Text>
        <Text style={styles.title}>{cheer}</Text>
        <Text style={styles.sub}>
          You finished {evaluated.length} of {exercises.length} exercises.
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreNumber}>{pct}%</Text>
        <Text style={styles.scoreLabel}>average score</Text>
      </View>

      <PrimaryCta
        label="Back to home →"
        onPress={onHome}
        from={colors.brand}
        to={colors.brandDeep}
      />
    </View>
  );
}
