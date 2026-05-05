/**
 * Centered loading spinner with an optional caption. Replaces the
 * `<View style={center}><ActivityIndicator/><Text>...</Text></View>`
 * triplet repeated on every async screen.
 */
import { ActivityIndicator, Text, View } from "react-native";

import { colors } from "@/lib/theme";

import { loadingBlockStyles as styles } from "./LoadingBlock.styles";

export function LoadingBlock({
  label,
  light = false,
}: {
  label?: string;
  /** Use brand-colored spinner on light backgrounds (default). Pass true for dark backgrounds. */
  light?: boolean;
}) {
  const tint = light ? "#ffffff" : colors.brand;
  return (
    <View style={styles.center}>
      <ActivityIndicator color={tint} />
      {label ? (
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
      ) : null}
    </View>
  );
}
