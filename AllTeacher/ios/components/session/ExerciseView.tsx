/**
 * Composer for one active exercise. Picks the body component for the
 * exercise type, shows a scoring spinner during submission, then a
 * feedback card + advance CTA once it's evaluated.
 */
import { ActivityIndicator, Text, View } from "react-native";

import type {
  ExerciseRow,
  ExerciseSubmission,
} from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing, typeAccent } from "@/lib/theme";

import { EssayPrompt } from "./EssayPrompt";
import { ExerciseHeader } from "./ExerciseHeader";
import { exerciseViewStyles as styles } from "./ExerciseView.styles";
import { FeedbackCard } from "./FeedbackCard";
import { Flashcard } from "./Flashcard";
import { MultipleChoice } from "./MultipleChoice";
import { ShortAnswer } from "./ShortAnswer";

export function ExerciseView({
  exercise,
  total,
  index,
  onSubmit,
  onNext,
  isLast,
}: {
  exercise: ExerciseRow;
  total: number;
  index: number;
  onSubmit: (s: ExerciseSubmission) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const c = exercise.content_json;
  const evaluated = exercise.status === "evaluated";
  const submitting = exercise.status === "submitted" && !evaluated;
  const feedback = exercise.feedback_json;
  const accent =
    typeAccent[c.type as keyof typeof typeAccent] ?? typeAccent.multiple_choice;

  return (
    <View style={{ gap: spacing.lg }}>
      <ExerciseHeader exercise={exercise} index={index} total={total} />

      {c.type === "multiple_choice" ? (
        <MultipleChoice
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onPick={(idx) => onSubmit({ choice_index: idx })}
        />
      ) : c.type === "flashcard" ? (
        <Flashcard
          // Re-mount per exercise so the flip state resets cleanly.
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onRate={(rating) => onSubmit({ self_rating: rating })}
        />
      ) : c.type === "short_answer" ? (
        <ShortAnswer
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onSubmit={(text) => onSubmit({ text })}
        />
      ) : c.type === "essay_prompt" ? (
        <EssayPrompt
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onSubmit={(text) => onSubmit({ text })}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Unknown exercise type.</Text>
        </View>
      )}

      {submitting ? (
        <View style={styles.scoring}>
          <ActivityIndicator color={colors.textOnDark} />
          <Text style={styles.scoringText}>Scoring…</Text>
        </View>
      ) : null}

      {evaluated && feedback ? (
        <FeedbackCard feedback={feedback} content={c} />
      ) : null}

      {evaluated ? (
        <PrimaryCta
          label={isLast ? "Finish session 🎉" : "Next exercise →"}
          onPress={onNext}
          from={accent.gradientFrom}
          to={accent.gradientTo}
        />
      ) : null}
    </View>
  );
}
