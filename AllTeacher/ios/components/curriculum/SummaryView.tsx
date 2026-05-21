/**
 * Assessment summary + "Generate my plan" CTA. Shown after the Assessor
 * has marked the curriculum complete and before the Planner has run.
 */
import { Text, View } from "react-native";

import type { AssessorSummary } from "@/lib/api";
import { spacing } from "@/lib/theme";
import { PrimaryCta } from "@/components/ui";

import { SummaryRow } from "./SummaryRow";
import { summaryViewStyles as styles } from "./SummaryView.styles";

export function SummaryView({
  summary,
  planning,
  onGenerate,
}: {
  summary: AssessorSummary;
  planning: boolean;
  onGenerate: () => void;
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.heroBlock}>
        <Text style={styles.eyebrow}>Step 2 of 2</Text>
        <Text style={styles.title}>Assessment{"\n"}complete ✅</Text>
        <Text style={styles.sub}>
          Here's what we picked up from your answers.
        </Text>
      </View>

      <View style={styles.card}>
        <SummaryRow icon="🎓" label="Domain" value={summary.domain} />
        <SummaryRow icon="📊" label="Level" value={summary.level} />
        <SummaryRow
          icon="💡"
          label="Learning style"
          value={summary.learning_style}
        />
        <SummaryRow
          icon="⏱️"
          label="Time / day"
          value={`${summary.time_budget_mins_per_day} min`}
        />
        {summary.target_language ? (
          <SummaryRow
            icon="🌍"
            label="Target language"
            value={summary.target_language}
          />
        ) : null}
        {summary.notes ? (
          <SummaryRow icon="📝" label="Notes" value={summary.notes} />
        ) : null}
      </View>

      <PrimaryCta
        label="✨ Generate my plan"
        onPress={onGenerate}
        loading={planning}
        disabled={planning}
      />
      <Text style={styles.hint}>
        {planning
          ? "Drafting your week-by-week plan… 10–30 seconds."
          : "We'll build a personal week-by-week curriculum from this."}
      </Text>
    </View>
  );
}
