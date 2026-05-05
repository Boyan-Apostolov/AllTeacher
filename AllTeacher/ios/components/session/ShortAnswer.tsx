/**
 * Short-answer exercise body — neo-brutalist redesign.
 * Ink-bordered prompt + text input + solid brand CTA.
 */
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

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
        placeholderTextColor={colors.ink4}
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
        bg={colors.short}
        color={colors.ink}
      />
    </View>
  );
}
