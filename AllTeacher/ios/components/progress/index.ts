/**
 * Barrel export for the progress dashboard components.
 *
 * Keep this surface narrow — only re-export what other screens are likely
 * to render directly. Internal helpers stay private to their files.
 */
export { MetricGrid } from "./MetricGrid";
export type { Metric } from "./MetricGrid";

export { ProgressStrip } from "./ProgressStrip";

export { StreakCard } from "./StreakCard";

export { TagList } from "./TagList";
export type { TagListVariant } from "./TagList";

export { WeekProgressList } from "./WeekProgressList";
