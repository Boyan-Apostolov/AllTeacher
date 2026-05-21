/**
 * Streak card — flame + current/best streak + 30-day heatmap row.
 *
 * Activity comes pre-shaped from the backend (oldest → newest), so this
 * component is purely presentational.
 */
import { Text, View } from "react-native";

import type { ActivityDay, StreakSummary } from "@/lib/api";

import { streakCardStyles as styles } from "./StreakCard.styles";

export function StreakCard({
  streak,
  activity,
}: {
  streak: StreakSummary;
  activity: ActivityDay[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.flameWrap}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={styles.daysNumber}>{streak.current_days}</Text>
          <Text style={styles.daysLabel}>
            day{streak.current_days === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.bestPill}>
          <Text style={styles.bestText}>Best · {streak.best_days}</Text>
        </View>
      </View>

      <View style={styles.heatmap}>
        {activity.map((d) => (
          <View
            key={d.date}
            style={[
              styles.cell,
              d.active && styles.cellActive,
              d.date === today && styles.cellToday,
            ]}
          />
        ))}
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>30 days ago</Text>
        <Text style={styles.legendText}>today</Text>
      </View>
    </View>
  );
}
