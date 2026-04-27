/**
 * Exercise header — type pill + "X of Y" count + exercise title.
 */
import { Text, View } from "react-native";

import { typeAccent } from "@/lib/theme";
import type { ExerciseRow } from "@/lib/api";

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

  return (
    <View style={styles.block}>
      <View style={styles.kindRow}>
        <View style={styles.kindPill}>
          <Text style={styles.kindEmoji}>{accent.emoji}</Text>
          <Text style={styles.kindText}>{accent.label}</Text>
        </View>
        <Text style={styles.kindCount}>
          {Math.min(index + 1, total)} of {total}
        </Text>
      </View>
      <Text style={styles.title}>{c.title}</Text>
    </View>
  );
}
