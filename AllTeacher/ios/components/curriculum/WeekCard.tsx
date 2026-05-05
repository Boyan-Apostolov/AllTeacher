/**
 * WeekCard — neo-brutalist redesign.
 * White card, chunky border + offset shadow, color-coded by state.
 */
import { Pressable, Text, View } from "react-native";
import type { PlanWeek, WeekRow } from "@/lib/api";
import { colors } from "@/lib/theme";
import { weekCardStyles as styles } from "./WeekCard.styles";

function weekColor(index: number) {
  const palette = [colors.brand, colors.flash, colors.mc, colors.short, colors.ok, colors.amber];
  return palette[index % palette.length];
}

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
  const badgeColor = weekColor(index);
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
        <View style={[styles.badge, { backgroundColor: isComplete ? colors.ok : badgeColor }]}>
          <Text style={styles.badgeText}>
            {isComplete ? "✓" : `${week.week_number}`}
          </Text>
        </View>
        <View style={styles.headerCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{week.title}</Text>
            {isComplete ? (
              <View style={styles.statusPillDone}>
                <Text style={styles.statusPillDoneText}>Done</Text>
              </View>
            ) : isInProgress ? (
              <View style={styles.statusPillProgress}>
                <Text style={styles.statusPillProgressText}>now</Text>
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
          <Text style={styles.metaPillText}>⏱ {week.daily_minutes} min/day</Text>
        </View>
      </View>
      {week.exercise_focus.length > 0 ? (
        <Text style={styles.focusText}>
          Focus: {week.exercise_focus.join(" · ")}
        </Text>
      ) : null}

      {onStartSession ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={onStartSession}
        >
          <View style={[styles.ctaGradient, { backgroundColor: isComplete ? colors.ok : badgeColor }]}>
            <Text style={styles.ctaText}>
              {isComplete ? "Review session ✓" : isInProgress ? "Continue session →" : "Start session →"}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
