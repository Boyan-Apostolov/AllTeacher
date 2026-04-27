/**
 * Essay-prompt exercise body. Tall textarea + optional rubric + submit.
 */
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing, typeAccent } from "@/lib/theme";

import { textResponseStyles as styles } from "./TextResponse.styles";

export function EssayPrompt({
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
  const accent = typeAccent.essay_prompt;

  const trimmed = text.trim();
  const submitDisabled = disabled || trimmed.length === 0;

  return (
    <View style={{ gap: spacing.md }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      {content.expected_length ? (
        <Text style={styles.metaPill}>
          Suggested length: {content.expected_length}
        </Text>
      ) : null}
      {(content.rubric?.length ?? 0) > 0 ? (
        <View style={styles.rubricCard}>
          <Text style={styles.rubricTitle}>What we'll look for</Text>
          {content.rubric!.map((r, i) => (
            <View key={i} style={styles.rubricRow}>
              <Text style={styles.rubricBullet}>•</Text>
              <Text style={styles.rubricText}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        style={[
          styles.textInput,
          styles.textInputTall,
          focused && styles.textInputFocused,
          disabled && styles.textInputDisabled,
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Write here…"
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
      />
      <PrimaryCta
        label="Submit response →"
        onPress={() => onSubmit(trimmed)}
        disabled={submitDisabled}
        from={accent.gradientFrom}
        to={accent.gradientTo}
      />
    </View>
  );
}
