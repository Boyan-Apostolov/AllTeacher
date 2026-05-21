/**
 * Tile grid for top-level numeric metrics — sessions / exercises / avg
 * score / curricula. Caller passes a list of {label, value, hint?}.
 */
import { Text, View } from "react-native";

import { metricGridStyles as styles } from "./MetricGrid.styles";

export type Metric = {
  label: string;
  value: string;
  hint?: string;
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <View style={styles.grid}>
      {metrics.map((m) => (
        <View key={m.label} style={styles.cell}>
          <Text style={styles.label}>{m.label}</Text>
          <Text style={styles.value}>{m.value}</Text>
          {m.hint ? <Text style={styles.hint}>{m.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}
