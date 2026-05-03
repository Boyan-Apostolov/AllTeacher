/**
 * Composer for one active exercise. Picks the body component for the
 * exercise type, shows a scoring spinner during submission, then a
 * feedback card + advance CTA once it's evaluated.
 *
 * Legacy `essay_prompt` rows still in the DB (the type was retired in
 * favour of `short_answer` with a rubric) get routed through ShortAnswer
 * here so old curricula keep working without a data migration.
 *
 * Streaming evaluator (added with the SSE submit endpoint): when the
 * parent passes `streamingFeedback`, ExerciseView swaps the "Scoring…"
 * spinner for a live FeedbackCard that renders the partial `feedback`
 * and `gap` text as they arrive. Used today for `short_answer` only —
 * multiple-choice and flashcards score instantly so streaming would
 * just add latency.
 */
import { ActivityIndicator, Text, View } from "react-native";

import type {
  ExerciseFeedback,
  ExerciseRow,
  ExerciseSubmission,
} from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing, typeAccent } from "@/lib/theme";

import { ExerciseHeader } from "./ExerciseHeader";
import { exerciseViewStyles as styles } from "./ExerciseView.styles";
import { FeedbackCard } from "./FeedbackCard";
import { Flashcard } from "./Flashcard";
import { ListenChoice } from "./ListenChoice";
import { MultipleChoice } from "./MultipleChoice";
import { ShortAnswer } from "./ShortAnswer";

// Empty-but-typed feedback used when we render the streaming card BEFORE
// the final ExerciseFeedback exists. FeedbackCard ignores these defaults
// in streaming mode — only the `streaming` prop's text is shown — but
// the type still needs filling.
const PLACEHOLDER_FEEDBACK: ExerciseFeedback = {
  score: 0,
  verdict: "reviewed",
  feedback: "",
  gap: "",
  weak_areas: [],
  strengths: [],
  next_focus: "",
};

export function ExerciseView({
  exercise,
  total,
  index,
  onSubmit,
  onNext,
  isLast,
  streamingFeedback,
}: {
  exercise: ExerciseRow;
  total: number;
  index: number;
  onSubmit: (s: ExerciseSubmission) => void;
  onNext: () => void;
  isLast: boolean;
  /**
   * Partial Evaluator output when the parent is mid-stream on this
   * exercise. Presence of this prop signals "streaming"; absence with
   * `exercise.status === 'submitted'` falls back to the spinner.
   */
  streamingFeedback?: { feedback?: string; gap?: string };
}) {
  const c = exercise.content_json;
  const evaluated = exercise.status === "evaluated";
  const submitting = exercise.status === "submitted" && !evaluated;
  const feedback = exercise.feedback_json;
  const accent =
    typeAccent[c.type as keyof typeof typeAccent] ?? typeAccent.multiple_choice;
  const isStreaming = submitting && streamingFeedback !== undefined;

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
      ) : c.type === "listen_choice" ? (
        // Audio comprehension — same submission shape as MCQ
        // (`{ choice_index }`) so the Evaluator path is identical.
        // Re-mount per exercise so the loaded sound is unloaded
        // cleanly and we don't bleed audio between cards.
        <ListenChoice
          key={exercise.id}
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
      ) : c.type === "short_answer" || c.type === "essay_prompt" ? (
        // essay_prompt is legacy — fall through to ShortAnswer so
        // existing rows still render after the schema simplification.
        <ShortAnswer
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

      {submitting && !isStreaming ? (
        <View style={styles.scoring}>
          <ActivityIndicator color={colors.ink3} />
          <Text style={styles.scoringText}>Scoring…</Text>
        </View>
      ) : null}

      {isStreaming ? (
        <FeedbackCard
          feedback={PLACEHOLDER_FEEDBACK}
          content={c}
          streaming={streamingFeedback}
        />
      ) : evaluated && feedback ? (
        <FeedbackCard feedback={feedback} content={c} />
      ) : null}

      {evaluated ? (
        <PrimaryCta
          label={isLast ? "Finish session 🎉" : "Next exercise →"}
          onPress={onNext}
          bg={accent.fg}
          color="#fff"
        />
      ) : null}
    </View>
  );
}
