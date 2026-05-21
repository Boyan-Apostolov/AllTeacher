/**
 * Lesson screen — renders one Explainer-generated micro-lesson before the
 * exercises that drill the same concept.
 *
 * Shape comes from `LessonContent` in `lib/api.ts`:
 *   concept_title, intro, key_points[], example, pitfalls[], next_up.
 *
 * Length adapts upstream (the Explainer agent tunes its output to the
 * user's level) — this component just lays out whatever it gets, with
 * empty arrays gracefully hidden.
 */
import { Text, View } from "react-native";

import { PrimaryCta } from "@/components/ui";
import type { LessonRow } from "@/lib/api";

import { lessonViewStyles as styles } from "./LessonView.styles";

const ACCENT = {
  gradientFrom: "#a78bfa",
  gradientTo: "#7c5cff",
  emoji: "📚",
  label: "Lesson",
};

export function LessonView({
  lesson,
  moduleIndex,
  totalModules,
  onStartExercises,
}: {
  lesson: LessonRow;
  moduleIndex: number;
  totalModules: number;
  onStartExercises: () => void;
}) {
  const c = lesson.content_json;
  const title = c.concept_title || lesson.concept_title || "Lesson";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.kindRow}>
          <View style={styles.kindPill}>
            <Text style={styles.kindEmoji}>{ACCENT.emoji}</Text>
            <Text style={styles.kindText}>{ACCENT.label}</Text>
          </View>
          <Text style={styles.kindCount}>
            Concept {Math.min(moduleIndex + 1, totalModules)} of {totalModules}
          </Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.card}>
        {c.intro ? <Text style={styles.intro}>{c.intro}</Text> : null}

        {c.key_points && c.key_points.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Key points</Text>
            {c.key_points.map((pt, i) => (
              <View key={`kp-${i}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{pt}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {c.example ? (
          <View>
            <Text style={styles.sectionLabel}>Example</Text>
            <View style={styles.exampleBox}>
              <Text style={styles.exampleText}>{c.example}</Text>
            </View>
          </View>
        ) : null}

        {c.pitfalls && c.pitfalls.length > 0 ? (
          <View style={styles.pitfallBox}>
            <Text style={styles.pitfallLabel}>Watch out</Text>
            {c.pitfalls.map((p, i) => (
              <View key={`pf-${i}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {c.next_up ? <Text style={styles.nextUp}>{c.next_up}</Text> : null}

      <PrimaryCta
        label="Start exercises →"
        onPress={onStartExercises}
        from={ACCENT.gradientFrom}
        to={ACCENT.gradientTo}
      />
    </View>
  );
}
