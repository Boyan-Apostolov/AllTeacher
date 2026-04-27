/**
 * Compact per-curriculum progress strip rendered above the plan view on
 * the curriculum detail screen.
 *
 * Shows current week, sessions done / total, avg score and last activity,
 * with a "Re-plan upcoming weeks" Pressable that calls the Adapter through
 * the parent. Pure presentation — the parent owns the data fetch and the
 * replan call.
 */
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import type { CurriculumProgressDetail } from "@/lib/api";
import { formatRelative, formatScorePct } from "@/lib/curriculum";

import { progressStripStyles as styles } from "./ProgressStrip.styles";

export function ProgressStrip({
  detail,
  replanning,
  onReplan,
  onOpenDashboard,
}: {
  detail: CurriculumProgressDetail;
  replanning?: boolean;
  onReplan?: () => void;
  onOpenDashboard?: () => void;
}) {
  const t = detail.totals;
  const sessions =
    t.sessions_total > 0
      ? `${t.sessions_completed}/${t.sessions_total}`
      : "—";
  const avg =
    t.avg_score === null ? "—" : formatScorePct(t.avg_score);

  // Pick the lowest non-complete week as "current" — matches how the
  // detail screen pins UpNextCard.
  const currentWeek =
    detail.weeks
      .slice()
      .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
      .find((w) => w.status !== "complete")?.week_number ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Progress</Text>
        {detail.replan_count > 0 ? (
          <Text style={styles.replanBadge}>
            re-planned · {detail.replan_count}
          </Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {currentWeek !== null ? `wk ${currentWeek}` : "✓"}
          </Text>
          <Text style={styles.statLabel}>current</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sessions}</Text>
          <Text style={styles.statLabel}>sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{avg}</Text>
          <Text style={styles.statLabel}>avg score</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {detail.streak.current_days}d
          </Text>
          <Text style={styles.statLabel}>streak</Text>
        </View>
      </View>

      <Text style={styles.lastActive}>
        Last active · {formatRelative(detail.last_active_at)}
      </Text>

      <View style={styles.actionRow}>
        {onOpenDashboard ? (
          <Pressable
            style={styles.ghostBtn}
            onPress={onOpenDashboard}
          >
            <Text style={styles.ghostBtnText}>📊 Dashboard</Text>
          </Pressable>
        ) : null}
        {onReplan ? (
          <Pressable
            style={[styles.ctaBtn, replanning && styles.ctaBtnDisabled]}
            onPress={onReplan}
            disabled={replanning}
          >
            {replanning ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.ctaBtnText}>↻ Re-plan upcoming</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
