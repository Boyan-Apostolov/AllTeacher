/**
 * Tiny pill that shows a status label with custom fg/bg colors. Used by
 * curriculum rows on the home screen and by week cards in the course
 * detail view, so a single component owns the styling.
 */
import { Text, View, ViewStyle } from "react-native";

import { statusPillStyles as styles } from "./StatusPill.styles";

export function StatusPill({
  label,
  bg,
  fg,
  style,
}: {
  label: string;
  bg: string;
  fg: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}
