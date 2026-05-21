/**
 * Session-complete view. Shows:
 *   • Cheer line keyed to the average score
 *   • Big % score + per-exercise bar chart (color-coded by score band,
 *     bonus drill bars rendered semi-transparent so they read as a
 *     follow-up, not part of the original lesson grade)
 *   • "To revisit" / "Strong areas" recap aggregated from each
 *     exercise's Evaluator feedback
 *   • Bonus drill CTA when the avg dips below 60% AND the bonus run
 *     hasn't been started yet for this session — addresses the
 *     "low-scoring sessions should generate more drill" requirement
 *   • Back-to-home CTA
 *
 * The score card replaces the previous flat percentage so the user can
 * see *which* exercises pulled the average down and re-engage with
 * those concepts via the bonus drill.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";

import type { ExerciseRow } from "@/lib/api";
import { PrimaryCta } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

import { finishedViewStyles as styles } from "./FinishedView.styles";

const BONUS_THRESHOLD = 0.6;

function cheerFor(pct: number): string {
  if (pct >= 90) return "Outstanding! 🌟";
  if (pct >= 75) return "Strong work! 🎉";
  if (pct >= 50) return "Solid progress 💪";
  return "Every rep counts 🌱";
}

function barColor(score: number): string {
  if (score >= 0.9) return colors.success;
  if (score >= 0.6) return colors.warning;
  return colors.danger;
}

/**
 * Best-effort cross-row tag canonicalization for the recap.
 *
 * The Evaluator is told to reuse existing tags verbatim, but the model
 * still occasionally drifts: emits a translated variant in a different
 * language for the same theme, or coins a slight rewording like
 * "समय प्रबंधन" / "समय प्रबंधन रणनीतियाँ". This collapse is a safety
 * net so the user doesn't see the same theme listed three ways.
 *
 * Strategy:
 *   1. Trim + casefold every tag.
 *   2. Bucket tags whose normalized form is a prefix/substring of one
 *      another — group them under the SHORTEST normalized form (which
 *      tends to be the canonical noun phrase).
 *   3. Display the most frequent surface form within each bucket so we
 *      keep a real, human-written string rather than the casefolded
 *      version (which loses script/accents).
 */
function topTags(
  exercises: ExerciseRow[],
  pick: "weak_areas" | "strengths",
  limit = 4,
): string[] {
  type Bucket = {
    /** Canonical normalized form for this bucket (shortest seen). */
    canon: string;
    /** Surface forms (raw user-visible strings) → frequency. */
    forms: Map<string, number>;
    total: number;
  };
  const buckets: Bucket[] = [];

  for (const e of exercises) {
    const fb = e.feedback_json;
    if (!fb) continue;
    const tags = (pick === "weak_areas" ? fb.weak_areas : fb.strengths) ?? [];
    for (const raw of tags) {
      const surface = (raw ?? "").trim();
      if (!surface) continue;
      const norm = surface.toLocaleLowerCase().replace(/\s+/g, " ");

      // Find a bucket whose canon is contained in this norm or vice
      // versa — that's our "same theme" heuristic across languages and
      // minor reword variants.
      const match = buckets.find((b) => {
        if (b.canon === norm) return true;
        if (norm.length >= 4 && b.canon.length >= 4) {
          return b.canon.includes(norm) || norm.includes(b.canon);
        }
        return false;
      });

      if (match) {
        // Keep the shortest normalized form as the canonical key — it's
        // usually the "core" noun phrase before a qualifier was tacked on.
        if (norm.length < match.canon.length) match.canon = norm;
        match.forms.set(surface, (match.forms.get(surface) ?? 0) + 1);
        match.total += 1;
      } else {
        const forms = new Map<string, number>();
        forms.set(surface, 1);
        buckets.push({ canon: norm, forms, total: 1 });
      }
    }
  }

  // Pick the most-used surface form per bucket so the rendered string
  // stays in whichever language/script the model used most often.
  return buckets
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((b) => {
      let best = "";
      let bestN = -1;
      for (const [s, n] of b.forms) {
        if (n > bestN) {
          best = s;
          bestN = n;
        }
      }
      return best;
    });
}

export function FinishedView({
  exercises,
  bonusIds,
  bonusEligible,
  onHome,
  onStartBonus,
}: {
  exercises: ExerciseRow[];
  /** IDs of exercises that came from the bonus drill (visually faded). */
  bonusIds?: ReadonlySet<string>;
  /** True if the bonus drill is offered (not yet run for this session). */
  bonusEligible: boolean;
  onHome: () => void;
  onStartBonus: () => void;
}) {
  const evaluated = useMemo(
    () => exercises.filter((e) => e.status === "evaluated"),
    [exercises],
  );
  const avg = useMemo(
    () =>
      evaluated.length > 0
        ? evaluated.reduce((acc, e) => acc + (e.score ?? 0), 0) /
          evaluated.length
        : 0,
    [evaluated],
  );
  const pct = Math.round(avg * 100);
  const cheer = cheerFor(pct);
  const weak = useMemo(() => topTags(evaluated, "weak_areas"), [evaluated]);
  const strengths = useMemo(() => topTags(evaluated, "strengths"), [evaluated]);
  const hasBonusRows =
    bonusIds && evaluated.some((e) => bonusIds.has(e.id));
  const showBonusCta = bonusEligible && avg < BONUS_THRESHOLD;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Session complete</Text>
        <Text style={styles.title}>{cheer}</Text>
        <Text style={styles.sub}>
          You finished {evaluated.length} of {exercises.length} exercises.
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreNumber}>{pct}%</Text>
        <Text style={styles.scoreLabel}>average score</Text>

        {evaluated.length > 0 ? (
          <>
            <View style={styles.chart}>
              {evaluated.map((e, i) => {
                const s = Math.max(0, Math.min(1, e.score ?? 0));
                const isBonus = bonusIds?.has(e.id) ?? false;
                return (
                  <View key={e.id} style={styles.chartCol}>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: `${Math.max(6, s * 100)}%`,
                            backgroundColor: barColor(s),
                            opacity: isBonus ? 0.55 : 1,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel}>
                      {isBonus ? "★" : i + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: colors.success },
                  ]}
                />
                <Text style={styles.legendText}>90%+</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: colors.warning },
                  ]}
                />
                <Text style={styles.legendText}>60–89%</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: colors.danger },
                  ]}
                />
                <Text style={styles.legendText}>&lt; 60%</Text>
              </View>
              {hasBonusRows ? (
                <View style={styles.legendItem}>
                  <Text style={styles.legendText}>★ bonus drill</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {weak.length > 0 ? (
        <View style={styles.recapCard}>
          <Text style={styles.recapTitle}>To revisit</Text>
          {weak.map((w) => (
            <View key={w} style={styles.recapRow}>
              <View
                style={[styles.recapDot, { backgroundColor: colors.danger }]}
              />
              <Text style={styles.recapText}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {strengths.length > 0 ? (
        <View style={styles.recapCard}>
          <Text style={styles.recapTitle}>Strong areas</Text>
          {strengths.map((s) => (
            <View key={s} style={styles.recapRow}>
              <View
                style={[styles.recapDot, { backgroundColor: colors.success }]}
              />
              <Text style={styles.recapText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showBonusCta ? (
        <View style={styles.bonusCard}>
          <Text style={styles.bonusEyebrow}>Bonus drill</Text>
          <Text style={styles.bonusTitle}>Lock in your weak spots</Text>
          <Text style={styles.bonusBlurb}>
            Your score was below 60%. A few extra exercises focused on the
            concepts you struggled with can turn this around — give it a
            shot.
          </Text>
          <PrimaryCta
            label="Start bonus drill 🎯"
            onPress={onStartBonus}
            from={colors.accent}
            to={colors.brandDeep}
          />
        </View>
      ) : null}

      <PrimaryCta
        label="Back to home →"
        onPress={onHome}
        from={colors.brand}
        to={colors.brandDeep}
      />
    </View>
  );
}
