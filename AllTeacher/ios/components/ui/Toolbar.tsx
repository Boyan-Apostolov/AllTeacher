/**
 * Standard top toolbar: icon Back button on the left, screen title
 * (or arbitrary middle slot) in the centre, icon Home button on the right.
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
}: {
  title?: string;
  middle?: ReactNode;
  onBack?: () => void;
  onHome?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toolbar}>
      {onBack ? (
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={onBack}
          disabled={disabled}
          accessibilityLabel="Go back"
        >
          <Text style={styles.btnIcon}>←</Text>
        </Pressable>
      ) : (
        <View style={styles.btnSpacer} />
      )}

      {middle !== undefined ? (
        <View style={styles.middle}>{middle}</View>
      ) : (
        <Text style={styles.title} numberOfLines={1}>{title ?? ""}</Text>
      )}

      {onHome ? (
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={onHome}
          disabled={disabled}
          accessibilityLabel="Go home"
        >
          <Text style={styles.btnIcon}>⌂</Text>
        </Pressable>
      ) : (
        <View style={styles.btnSpacer} />
      )}
    </View>
  );
}
