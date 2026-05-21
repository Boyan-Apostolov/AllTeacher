/**
 * Short-answer exercise body. Multiline text input + submit.
 */
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing, typeAccent } from "@/lib/theme";

import { textResponseStyles as styles } from "./TextResponse.styles";

export function ShortAnswer({
  content,
  submission,
  disabled,
  onSubmit,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const initial =
    submission && "text" in submission ? submission.text : "";
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const accent = typeAccent.short_answer;

  const trimmed = text.trim();
  const submitDisabled = disabled || trimmed.length === 0;

  return (
    <View style={{ gap: spacing.md }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      <TextInput
        style={[
          styles.textInput,
          focused && styles.textInputFocused,
          disabled && styles.textInputDisabled,
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Type your answer…"
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        multiline
      />
      <PrimaryCta
        label="Submit answer →"
        onPress={() => onSubmit(trimmed)}
        disabled={submitDisabled}
        from={accent.gradientFrom}
        to={accent.gradientTo}
      />
    </View>
  );
}
