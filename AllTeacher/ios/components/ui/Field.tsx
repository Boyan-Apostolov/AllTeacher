/**
 * Labelled text input with a focus ring. Used by login + signup so they
 * stop redefining the same Field component locally.
 */
import { TextInput, Text, View } from "react-native";

import { colors } from "@/lib/theme";

import { fieldStyles as styles } from "./Field.styles";

type Props = React.ComponentProps<typeof TextInput> & {
  label: string;
  focused: boolean;
};

export function Field({ label, focused, style, ...rest }: Props) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}
