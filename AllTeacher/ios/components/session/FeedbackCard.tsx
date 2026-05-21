/**
 * Post-submission feedback card. Verdict-driven tone (correct, partial,
 * reviewed, incorrect) sets the icon/label/colors. Body shows the
 * scorer's feedback, the per-answer "why this missed the goal" gap,
 * weak areas, and the next-focus suggestion.
 *
 * The gap line replaces the previous static `content.explanation` block
 * — that one just restated the question's requirements; this one names
 * what the user's submission specifically failed to do. Comes from the
 * Evaluator at submission time. Empty for fully correct answers.
 */
import { Text, View } from "react-native";

import type { ExerciseContent, ExerciseFeedback } from "@/lib/api";
import { colors } from "@/lib/theme";

import { feedbackCardStyles as styles } from "./FeedbackCard.styles";

type Tone = { icon: string; label: string; bg: string; fg: string };

function toneFor(verdict: ExerciseFeedback["verdict"]): Tone {
  if (verdict === "correct") {
    return {
      icon: "🎉",
      label: "Correct!",
      bg: colors.successSoft,
      fg: colors.success,
    };
  }
  if (verdict === "incorrect") {
    return {
      icon: "💪",
      label: "Not quite",
      bg: colors.dangerSoft,
      fg: colors.danger,
    };
  }
  if (verdict === "reviewed") {
    return {
      icon: "🔁",
      label: "Reviewed",
      bg: colors.infoSoft,
      fg: colors.info,
    };
  }
  return {
    icon: "📝",
    label: "Partial",
    bg: colors.warningSoft,
    fg: colors.warning,
  };
}

export function FeedbackCard({
  feedback,
  content: _content,
}: {
  feedback: ExerciseFeedback;
  content: ExerciseContent;
}) {
  const tone = toneFor(feedback.verdict);
  const gap = (feedback.gap ?? "").trim();

  return (
    <View style={[styles.card, { backgroundColor: tone.bg }]}>
      <View style={styles.header}>
        <View style={styles.verdictRow}>
          <Text style={styles.icon}>{tone.icon}</Text>
          <Text style={[styles.verdict, { color: tone.fg }]}>
            {tone.label}
          </Text>
        </View>
        <Text style={[styles.score, { color: tone.fg }]}>
          {Math.round((feedback.score ?? 0) * 100)}%
        </Text>
      </View>
      <Text style={styles.body}>{feedback.feedback}</Text>
      {gap.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>Where it fell short</Text>
          <Text style={styles.body}>{gap}</Text>
        </View>
      ) : null}
      {feedback.weak_areas.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>To revisit</Text>
          {feedback.weak_areas.map((w, i) => (
            <Text key={i} style={styles.body}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}
      {feedback.next_focus ? (
        <View style={styles.block}>
          <Text style={styles.label}>Next focus</Text>
          <Text style={styles.body}>{feedback.next_focus}</Text>
        </View>
      ) : null}
    </View>
  );
}
