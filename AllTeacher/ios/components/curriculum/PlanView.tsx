/**
 * Plan view: pinned UpNextCard, phases, then a list of week cards. Pure
 * presentation — page screen owns the data and the navigation.
 */
import { Text, View } from "react-native";

import type { PlanOverview, WeekRow } from "@/lib/api";
import { spacing } from "@/lib/theme";

import { UpNextCard } from "./UpNextCard";
import { WeekCard } from "./WeekCard";
import { planViewStyles as styles } from "./PlanView.styles";

export function PlanView({
  plan,
  weeks,
  onStartSession,
}: {
  plan: PlanOverview;
  weeks: WeekRow[];
  onStartSession: (weekId: string) => void;
}) {
  const sortedWeeks = weeks
    .slice()
    .sort((a, b) => a.week_number - b.week_number);
  const upcoming =
    sortedWeeks.find((w) => w.status !== "complete") ?? null;
  const completedCount = sortedWeeks.filter(
    (w) => w.status === "complete",
  ).length;
  const totalCount = sortedWeeks.length;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={styles.heroBlock}>
        <Text style={styles.eyebrow}>{plan.total_weeks}-week plan</Text>
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.sub}>{plan.summary_for_user}</Text>
      </View>

      {totalCount > 0 ? (
        <UpNextCard
          upcoming={upcoming}
          completedCount={completedCount}
          totalCount={totalCount}
          onStart={onStartSession}
        />
      ) : null}

      {plan.phases.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionHeader}>Phases</Text>
          {plan.phases.map((p, i) => (
            <View key={`${i}-${p.name}`} style={styles.phaseCard}>
              <View style={styles.phaseStripe} />
              <View style={styles.phaseCol}>
                <Text style={styles.phaseName}>{p.name}</Text>
                <Text style={styles.phaseWeeks}>
                  Weeks {p.week_numbers.join(", ")}
                </Text>
                <Text style={styles.phaseDesc}>{p.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionHeader}>All sessions</Text>
        {sortedWeeks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No week details loaded.</Text>
          </View>
        ) : (
          sortedWeeks.map((row, idx) => (
            <WeekCard
              key={row.id || row.week_number}
              row={row}
              index={idx}
              isUpcoming={!!upcoming && row.id === upcoming.id}
              onStartSession={
                row.id ? () => onStartSession(row.id) : undefined
              }
            />
          ))
        )}
      </View>
    </View>
  );
}
