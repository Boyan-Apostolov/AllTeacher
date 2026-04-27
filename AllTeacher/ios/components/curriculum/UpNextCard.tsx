/**
 * "Up next" hero pinned at the top of a course view. Shows the upcoming
 * (or first incomplete) session prominently with course-level progress.
 */
import { Text, View } from "react-native";

import type { WeekRow } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { PrimaryCta, ProgressBar } from "@/components/ui";

import { upNextCardStyles as styles } from "./UpNextCard.styles";

export function UpNextCard({
  upcoming,
  completedCount,
  totalCount,
  onStart,
}: {
  upcoming: WeekRow | null;
  completedCount: number;
  totalCount: number;
  onStart?: (weekId: string) => void;
}) {
  const pct = totalCount > 0 ? completedCount / totalCount : 0;
  const allDone = totalCount > 0 && completedCount >= totalCount;

  if (totalCount === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>
          {allDone ? "Course complete" : "Up next"}
        </Text>
        <Text style={styles.progress}>
          {completedCount}/{totalCount} sessions
        </Text>
      </View>
      <ProgressBar
        pct={pct}
        height={8}
        color={allDone ? colors.success : colors.brand}
        style={styles.progressBar}
      />
      {upcoming ? (
        <>
          <Text style={styles.weekLabel}>
            Week {upcoming.plan_json.week_number}
            {upcoming.status === "in_progress" ? " · in progress" : ""}
          </Text>
          <Text style={styles.title}>{upcoming.plan_json.title}</Text>
          {upcoming.plan_json.objective ? (
            <Text style={styles.objective}>
              {upcoming.plan_json.objective}
            </Text>
          ) : null}
          {upcoming.id && onStart ? (
            <PrimaryCta
              label={
                upcoming.status === "in_progress"
                  ? "Continue session →"
                  : "Start session →"
              }
              onPress={() => onStart(upcoming.id)}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.objective}>
          Every session is done. Great work 🎉
        </Text>
      )}
    </View>
  );
}
