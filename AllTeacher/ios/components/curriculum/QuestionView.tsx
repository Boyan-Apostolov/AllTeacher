/**
 * Assessor MCQ — neo-brutalist redesign.
 * Progress bar, mascot speech bubble, A/B/C/D option cards.
 */
import { Pressable, Text, View } from "react-native";
import type { AssessorQuestion } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { LoadingBlock } from "@/components/ui";
import { Mascot } from "@/components/ui/Mascot";
import { questionViewStyles as styles } from "./QuestionView.styles";

export function QuestionView({
  question,
  number,
  submitting,
  onPick,
}: {
  question: AssessorQuestion;
  number: number;
  submitting: boolean;
  onPick: (choice: string) => void;
}) {
  const progress = Math.min(number / 10, 1);

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Mascot + speech bubble */}
      <View style={styles.bubbleRow}>
        <Mascot size={48} mood="thinking" color={colors.flash} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleLabel}>Quick check</Text>
          <Text style={styles.title}>{question.question}</Text>
        </View>
      </View>

      {/* Options */}
      <View style={{ gap: spacing.sm }}>
        {question.options.map((opt, idx) => (
          <Pressable
            key={`${idx}-${opt}`}
            style={({ pressed }) => [
              styles.option,
              submitting && styles.optionDisabled,
              pressed && !submitting && styles.optionPressed,
            ]}
            onPress={() => onPick(opt)}
            disabled={submitting}
          >
            <View style={styles.optionDot}>
              <Text style={styles.optionDotText}>
                {String.fromCharCode(65 + idx)}
              </Text>
            </View>
            <Text style={styles.optionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      {submitting ? <LoadingBlock label="Thinking…" /> : null}
    </View>
  );
}
