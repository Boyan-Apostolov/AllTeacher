/**
 * A small box for inline status feedback — error, info, or success. Each
 * variant uses the matching token from the design system.
 *
 * Replaces the half-dozen ad-hoc errorBox/infoBox styles that used to
 * live in every form screen.
 */
import { Text, View } from "react-native";

import { messageBoxStyles as styles } from "./MessageBox.styles";

type Variant = "error" | "info" | "success" | "warning";

export function MessageBox({
  variant = "error",
  title,
  message,
}: {
  variant?: Variant;
  title?: string;
  message: string;
}) {
  return (
    <View style={[styles.box, styles[`${variant}Box` as const]]}>
      {title ? (
        <Text style={[styles.title, styles[`${variant}Title` as const]]}>
          {title}
        </Text>
      ) : null}
      <Text style={[styles.text, styles[`${variant}Text` as const]]}>
        {message}
      </Text>
    </View>
  );
}
