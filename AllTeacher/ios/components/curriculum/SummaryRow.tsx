/**
 * One row in the assessment-summary card: emoji + label + value.
 */
import { Text, View } from "react-native";

import { summaryRowStyles as styles } from "./SummaryRow.styles";

export function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.col}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}
