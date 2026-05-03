/**
 * Field — neo-brutalist text input. White card with chunky ink border
 * + offset shadow. Label floats inside the card above the input.
 */
import { TextInput, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { fieldStyles as styles } from "./Field.styles";

type Props = React.ComponentProps<typeof TextInput> & {
  label: string;
  focused?: boolean;
};

export function Field({ label, focused, style, ...rest }: Props) {
  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.ink4}
        style={[styles.input, style]}
      />
    </View>
  );
}
