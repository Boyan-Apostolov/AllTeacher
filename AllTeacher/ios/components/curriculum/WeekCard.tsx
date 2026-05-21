/**
 * One week card — title + objective + module list + start CTA. Visual
 * state derives from `row.status`:
 *
 *   - complete   → green border, "Completed" pill, "Review session ✓" CTA
 *   - in_progress → "In progress" pill + "Continue session →" CTA
 *   - upcoming    → brand border (matches the "Up next" hero) + "Start"
 *   - default     → no special border
 */
import { Pressable, Text, View } from "react-native";

import type { PlanWeek, WeekRow } from "@/lib/api";
import { weekGradient } from "@/lib/curriculum";
import { Gradient } from "@/components/Gradient";
import { colors } from "@/lib/theme";

import { weekCardStyles as styles } from "./WeekCard.styles";

export function WeekCard({
  row,
  index,
  isUpcoming,
  onStartSession,
}: {
  row: WeekRow;
  index: number;
  isUpcoming?: boolean;
  onStartSession?: () => void;
}) {
  const week: PlanWeek = row.plan_json;
  const grad = weekGradient(index);
  const isComplete = row.status === "complete";
  const isInProgress = row.status === "in_progress";

  return (
    <View
      style={[
        styles.card,
        isComplete && styles.cardComplete,
        !isComplete && isUpcoming && styles.cardUpcoming,
      ]}
    >
      <View style={styles.header}>
        <Gradient
          from={grad.from}
          to={grad.to}
          angle={135}
          style={styles.badge}
        >
          <Text style={styles.badgeText}>
            {isComplete ? "✓" : `W${week.week_number}`}
          </Text>
        </Gradient>
        <View style={styles.headerCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{week.title}</Text>
            {isComplete ? (
              <View style={styles.statusPillDone}>
                <Text style={styles.statusPillDoneText}>Completed</Text>
              </View>
            ) : isInProgress ? (
              <View style={styles.statusPillProgress}>
                <Text style={styles.statusPillProgressText}>In progress</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.objective}>{week.objective}</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.fieldLabel}>Modules</Text>
      <View style={styles.modulesCol}>
        {week.modules.map((m, i) => (
          <View key={`${i}-${m.title}`} style={styles.moduleRow}>
            <View style={styles.kindPill}>
              <Text style={styles.kindPillText}>{m.kind}</Text>
            </View>
            <View style={styles.moduleCol}>
              <Text style={styles.moduleTitle}>{m.title}</Text>
              <Text style={styles.moduleDesc}>{m.description}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.divider} />
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>🎯 {week.milestone}</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            ⏱️ {week.daily_minutes} min/day
          </Text>
        </View>
      </View>
      {week.exercise_focus.length > 0 ? (
        <Text style={styles.focusText}>
          Focus: {week.exercise_focus.join(" · ")}
        </Text>
      ) : null}

      {onStartSession ? (
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
          onPress={onStartSession}
        >
          <Gradient
            from={isComplete ? colors.success : grad.from}
            to={isComplete ? colors.success : grad.to}
            angle={135}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {isComplete
                ? "Review session ✓"
                : isInProgress
                  ? "Continue session →"
                  : "Start session →"}
            </Text>
          </Gradient>
        </Pressable>
      ) : null}
    </View>
  );
}
