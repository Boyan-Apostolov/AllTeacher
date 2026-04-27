/**
 * Helpers for curriculum-related UI logic.
 *
 * Lives outside of any single screen so the home list, the per-course
 * detail screen, and (eventually) anywhere else that renders a curriculum
 * row can share the same status / progress / emoji rules.
 */
import { colors } from "@/lib/theme";
import type { CurriculumListItem } from "@/lib/api";

const GREETINGS = ["Hey", "Welcome back", "Ready to learn?"];

/** Pick a greeting that's stable per `seed` (typically the user's email). */
export function pickGreeting(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GREETINGS[h % GREETINGS.length];
}

/** Domain → emoji used in list rows / hero headers. */
export function domainEmoji(domain: string | null | undefined): string {
  switch (domain) {
    case "language":
      return "🗣️";
    case "code":
      return "💻";
    case "music":
      return "🎵";
    case "academic":
      return "📚";
    case "creative":
      return "🎨";
    case "fitness":
      return "💪";
    case "professional":
      return "💼";
    default:
      return "✨";
  }
}

export type StatusBadge = {
  badge: string;
  badgeBg: string;
  badgeFg: string;
};

/** Friendly badge text + colors for the curriculum's lifecycle state. */
export function statusBadge(c: CurriculumListItem): StatusBadge {
  if (c.planner_status === "complete") {
    return {
      badge: "Plan ready",
      badgeBg: colors.successSoft,
      badgeFg: "#15803d",
    };
  }
  if (c.assessor_status === "complete") {
    return {
      badge: "Ready to plan",
      badgeBg: colors.brandSoft,
      badgeFg: colors.brandDeep,
    };
  }
  if (c.assessor_status === "in_progress") {
    return {
      badge: "Assessing…",
      badgeBg: colors.warningSoft,
      badgeFg: "#a16207",
    };
  }
  return {
    badge: "New",
    badgeBg: colors.surfaceMuted,
    badgeFg: colors.textMuted,
  };
}

export type CurriculumProgress = {
  pct: number;
  stepLabel: string;
  barColor: string;
};

/**
 * Real progress %, derived from `sessions_completed / sessions_total` once
 * the planner has finished. Earlier in the lifecycle we surface a
 * "step 1/3 / 2/3" indicator so the bar still feels meaningful.
 */
export function curriculumProgress(c: CurriculumListItem): CurriculumProgress {
  if (c.planner_status === "complete") {
    const total = c.sessions_total ?? 0;
    const done = c.sessions_completed ?? 0;
    if (total > 0) {
      const pct = Math.max(0, Math.min(1, done / total));
      const all = done >= total;
      const stepLabel = all
        ? `All ${total} sessions complete 🎉`
        : `${done} of ${total} sessions · ${Math.round(pct * 100)}%`;
      const barColor = all
        ? colors.success
        : done > 0
          ? colors.brand
          : colors.textFaint;
      return { pct: all ? 1 : Math.max(pct, 0.04), stepLabel, barColor };
    }
    // Plan ready but no week rows yet — show "ready to learn", not 100%.
    return {
      pct: 0.04,
      stepLabel: "Plan ready · start your first session",
      barColor: colors.brand,
    };
  }
  if (c.assessor_status === "complete") {
    return {
      pct: 0.66,
      stepLabel: "Step 2/3 · generate your plan",
      barColor: colors.brand,
    };
  }
  if (c.assessor_status === "in_progress") {
    return {
      pct: 0.33,
      stepLabel: "Step 1/3 · assessment in progress",
      barColor: colors.warning,
    };
  }
  return {
    pct: 0.05,
    stepLabel: "Step 1/3 · start assessment",
    barColor: colors.textFaint,
  };
}

/**
 * Recurring gradient palette for week cards — index in, color pair out.
 * Defined here so multiple list views can render the same week with the
 * same accent.
 */
export const WEEK_GRADIENTS: Array<{ from: string; to: string }> = [
  { from: "#a78bfa", to: "#7c5cff" },
  { from: "#67e8f9", to: "#0ea5e9" },
  { from: "#86efac", to: "#16a34a" },
  { from: "#fbbf24", to: "#d97706" },
  { from: "#fb7185", to: "#e11d48" },
  { from: "#f472b6", to: "#db2777" },
];

export function weekGradient(index: number): { from: string; to: string } {
  return WEEK_GRADIENTS[index % WEEK_GRADIENTS.length];
}
