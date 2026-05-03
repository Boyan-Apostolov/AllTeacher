/**
 * Exercise header — neo-brutalist redesign.
 * Progress bar track + colored fill + "X/Y" count + Sticker type label.
 */
import { Text, View } from "react-native";

import type { ExerciseRow } from "@/lib/api";
import { typeAccent } from "@/lib/theme";
import { Sticker } from "@/components/ui/Sticker";

import { exerciseHeaderStyles as styles } from "./ExerciseHeader.styles";

export function ExerciseHeader({
  exercise,
  index,
  total,
}: {
  exercise: ExerciseRow;
  index: number;
  total: number;
}) {
  const c = exercise.content_json;
  const accent =
    typeAccent[c.type as keyof typeof typeAccent] ?? typeAccent.multiple_choice;
  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <View style={styles.block}>
      <View style={styles.topRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: accent.fg },
            ]}
          />
        </View>
        <Text style={styles.countText}>
          {Math.min(index + 1, total)}/{total}
        </Text>
      </View>
      <Sticker bg={accent.fg} color="#fff" rotate={-3} uppercase={false}>
        {accent.emoji} {accent.label}
      </Sticker>
    </View>
  );
}
