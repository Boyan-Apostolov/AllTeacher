/**
 * Assessor MCQ — progress dots, question text, four answer options, and
 * a "Thinking…" indicator when the answer is being submitted.
 */
import { Pressable, Text, View } from "react-native";

import type { AssessorQuestion } from "@/lib/api";
import { spacing } from "@/lib/theme";
import { LoadingBlock } from "@/components/ui";

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
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < Math.min(number, 6) && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.eyebrow}>Question {number}</Text>
        <Text style={styles.title}>{question.question}</Text>
      </View>

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
