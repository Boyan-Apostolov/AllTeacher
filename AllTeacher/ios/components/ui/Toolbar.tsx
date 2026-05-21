/**
 * Standard top toolbar: pill-shaped Back button on the left, screen title
 * (or arbitrary middle slot) in the middle, Home button on the right.
 *
 * Both action buttons are optional — pass undefined and the slot stays
 * empty (kept for layout balance via a transparent placeholder). Pass
 * `middle` to replace the centered title with custom content (e.g. a
 * progress bar during an exercise session).
 */
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { toolbarStyles as styles } from "./Toolbar.styles";

export function Toolbar({
  title,
  middle,
  onBack,
  onHome,
  disabled,
  backLabel = "← Back",
  homeLabel = "Home",
}: {
  title?: string;
  middle?: ReactNode;
  onBack?: () => void;
  onHome?: () => void;
  disabled?: boolean;
  backLabel?: string;
  homeLabel?: string;
}) {
  return (
    <View style={styles.toolbar}>
      {onBack ? (
        <Pressable
          style={styles.btn}
          onPress={onBack}
          disabled={disabled}
        >
          <Text style={styles.btnText}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.btnSpacer} />
      )}
      {middle !== undefined ? (
        <View style={styles.middle}>{middle}</View>
      ) : (
        <Text style={styles.title}>{title ?? ""}</Text>
      )}
      {onHome ? (
        <Pressable
          style={styles.btn}
          onPress={onHome}
          disabled={disabled}
        >
          <Text style={styles.btnText}>{homeLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.btnSpacer} />
      )}
    </View>
  );
}
