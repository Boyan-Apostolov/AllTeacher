/**
 * Diagnostic pill — small ✓/— badge used in the home screen's
 * "Diagnostics" strip to show whether API/JWT/OpenAI/Supabase are healthy.
 */
import { Text, View } from "react-native";

import { colors } from "@/lib/theme";

import { diagPillStyles as styles } from "./DiagPill.styles";

export function DiagPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: ok ? colors.successSoft : colors.dangerSoft },
      ]}
    >
      <Text style={styles.icon}>{ok ? "✓" : "—"}</Text>
      <Text
        style={[
          styles.text,
          { color: ok ? "#15803d" : colors.danger },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
