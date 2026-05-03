/**
 * Lesson screen — neo-brutalist redesign.
 * Concept Sticker header, white card with ink border, pitfall box,
 * example box, PrimaryCta "Start exercises →" in flash teal.
 */
import { Text, View } from "react-native";

import { PrimaryCta } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { MermaidDiagram } from "@/components/lesson/MermaidDiagram";
import type { LessonRow } from "@/lib/api";
import { colors } from "@/lib/theme";

import { lessonViewStyles as styles } from "./LessonView.styles";

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
      {/* Header */}
      <View style={styles.header}>
        <Sticker bg={colors.flash} color="#fff" rotate={-2} uppercase={false}>
          📚 Concept {Math.min(moduleIndex + 1, totalModules)} of {totalModules}
        </Sticker>
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Content card */}
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

        {c.diagram_mermaid && c.diagram_mermaid.trim().length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Visual</Text>
            <MermaidDiagram source={c.diagram_mermaid} />
          </View>
        ) : null}

        {c.pitfalls && c.pitfalls.length > 0 ? (
          <View style={styles.pitfallBox}>
            <Text style={styles.pitfallLabel}>⚠️ Watch out</Text>
            {c.pitfalls.map((p, i) => (
              <View key={`pf-${i}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {c.next_up ? <Text style={styles.nextUp}>Up next: {c.next_up}</Text> : null}

      <PrimaryCta
        label="Start exercises →"
        onPress={onStartExercises}
        bg={colors.flash}
      />
    </View>
  );
}
