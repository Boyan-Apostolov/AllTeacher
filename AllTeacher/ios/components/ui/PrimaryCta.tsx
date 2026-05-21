/**
 * The big gradient pill button that appears at the bottom of every form
 * and at the end of the upcoming-session card. One component, one set of
 * styles, every screen gets the same look and motion.
 */
import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";

import { Gradient } from "@/components/Gradient";
import { colors } from "@/lib/theme";

import { primaryCtaStyles as styles } from "./PrimaryCta.styles";

export function PrimaryCta({
  label,
  onPress,
  loading,
  disabled,
  from = colors.brand,
  to = colors.brandDeep,
  via,
  angle = 135,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
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
        isDisabled && styles.ctaDisabled,
        pressed && !isDisabled && styles.ctaPressed,
        style,
      ]}
    >
      <Gradient
        from={from}
        via={via}
        to={to}
        angle={angle}
        style={styles.ctaGradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnDark} />
        ) : (
          <Text style={styles.ctaText}>{label}</Text>
        )}
      </Gradient>
    </Pressable>
  );
}
