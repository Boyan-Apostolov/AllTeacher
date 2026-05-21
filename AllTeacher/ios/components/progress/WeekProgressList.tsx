/**
 * Per-week progress list — one row per curriculum_weeks row, showing
 * status, exercise progress, average score, and a bonus-week badge for
 * Adapter-inserted remediation weeks.
 */
import { Text, View } from "react-native";

import type { WeekProgress } from "@/lib/api";
import { formatScorePct } from "@/lib/curriculum";

import { weekProgressListStyles as styles } from "./WeekProgressList.styles";

function metaFor(w: WeekProgress): string {
  const parts: string[] = [];
  if (w.exercises_total > 0) {
    parts.push(`${w.exercises_completed}/${w.exercises_total} exercises`);
  } else {
    parts.push("not started");
  }
  if (w.status === "complete") parts.push("done");
  else if (w.status === "in_progress") parts.push("in progress");
  return parts.join(" · ");
}

export function WeekProgressList({ weeks }: { weeks: WeekProgress[] }) {
  if (!weeks || weeks.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.header}>Weeks</Text>
        <Text style={styles.empty}>No plan yet.</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.header}>Weeks</Text>
      {weeks.map((w) => {
        const isComplete = w.status === "complete";
        const isBonus = !!w.is_bonus;
        return (
          <View key={w.id} style={styles.row}>
            <View
              style={[
                styles.index,
                isComplete && styles.indexComplete,
                isBonus && styles.indexBonus,
              ]}
            >
              <Text
                style={[
                  styles.indexText,
                  isComplete && styles.indexCompleteText,
                  isBonus && styles.indexBonusText,
                ]}
              >
                {w.week_number ?? "·"}
              </Text>
            </View>

            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {w.title || `Week ${w.week_number ?? "—"}`}
                </Text>
                {isBonus ? <Text style={styles.bonusBadge}>BONUS</Text> : null}
              </View>
              <Text style={styles.meta}>{metaFor(w)}</Text>
            </View>

            <View style={styles.scoreCol}>
              {w.avg_score === null || w.avg_score === undefined ? (
                <Text style={styles.scoreLabel}>—</Text>
              ) : (
                <>
                  <Text style={styles.scoreText}>
                    {formatScorePct(w.avg_score)}
                  </Text>
                  <Text style={styles.scoreLabel}>avg</Text>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
