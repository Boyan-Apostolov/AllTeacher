/**
 * PrimaryCta — the big neo-brutalist pill CTA button.
 * Chunky ink border, offset hard shadow, no gradient.
 * Accepts bg/color overrides for per-exercise-type theming.
 */
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from "react-native";
import { colors } from "@/lib/theme";
import { primaryCtaStyles as styles } from "./PrimaryCta.styles";

export function PrimaryCta({
  label,
  onPress,
  loading,
  disabled,
  bg = colors.brand,
  color = "#fff",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Background color of the button */
  bg?: string;
  /** Text/icon color */
  color?: string;
  // Legacy gradient props — accepted but ignored
  from?: string;
  to?: string;
  via?: string;
  angle?: number;
  style?: ViewStyle;
}) {
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: bg },
        isDisabled && styles.ctaDisabled,
        pressed && !isDisabled && styles.ctaPressed,
        style,
      ]}
    >
      <View style={[styles.ctaInner, { backgroundColor: bg }]}>
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <Text style={[styles.ctaText, { color }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}
