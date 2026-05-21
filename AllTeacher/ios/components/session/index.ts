/**
 * Barrel for the active-session components. Page screens should import
 * the composed `ExerciseView` and `FinishedView` from here; per-type
 * bodies (MultipleChoice/Flashcard/ShortAnswer) are exported for
 * completeness but rarely used directly.
 *
 * The `EssayPrompt` body component was removed when essay_prompt was
 * retired — long-form writing tasks now use ShortAnswer with a rubric.
 * Legacy essay_prompt rows in the DB are routed to ShortAnswer by
 * ExerciseView.
 */
export { ExerciseHeader } from "./ExerciseHeader";
export { ExerciseView } from "./ExerciseView";
export { FeedbackCard } from "./FeedbackCard";
export { FinishedView } from "./FinishedView";
export { Flashcard } from "./Flashcard";
export { LessonView } from "./LessonView";
export { MultipleChoice } from "./MultipleChoice";
export { ShortAnswer } from "./ShortAnswer";
