/**
 * Multiple-choice exercise body. Picking an option submits immediately.
 * After submission, options are colored to reveal the correct answer
 * and (if applicable) which one the user picked incorrectly.
 */
import { Pressable, Text, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { spacing } from "@/lib/theme";

import { multipleChoiceStyles as styles } from "./MultipleChoice.styles";

export function MultipleChoice({
  content,
  submission,
  disabled,
  onPick,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onPick: (idx: number) => void;
}) {
  const chosen =
    submission && "choice_index" in submission
      ? submission.choice_index
      : null;
  const correct = content.correct_index;

  return (
    <View style={{ gap: spacing.sm }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        {(content.options ?? []).map((opt, idx) => {
          const isChosen = chosen === idx;
          const showCorrect = disabled && correct === idx;
          const showWrong = disabled && isChosen && correct !== idx;
          return (
            <Pressable
              key={`${idx}-${opt}`}
              style={({ pressed }) => [
                styles.option,
                isChosen && styles.optionChosen,
                showCorrect && styles.optionCorrect,
                showWrong && styles.optionWrong,
                disabled && !isChosen && !showCorrect && styles.optionFaded,
                pressed && !disabled && styles.optionPressed,
              ]}
              onPress={() => onPick(idx)}
              disabled={disabled}
            >
              <View
                style={[
                  styles.optionDot,
                  showCorrect && styles.optionDotCorrect,
                  showWrong && styles.optionDotWrong,
                ]}
              >
                <Text
                  style={[
                    styles.optionDotText,
                    (showCorrect || showWrong) && styles.optionDotTextOnAccent,
                  ]}
                >
                  {showCorrect
                    ? "✓"
                    : showWrong
                      ? "✕"
                      : String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
