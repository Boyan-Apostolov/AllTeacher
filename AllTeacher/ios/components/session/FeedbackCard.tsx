/**
 * Post-submission feedback card. Verdict-driven tone (correct, partial,
 * reviewed, incorrect) sets the icon/label/colors. Body shows the
 * scorer's feedback, the per-answer "why this missed the goal" gap,
 * weak areas, and the next-focus suggestion.
 *
 * The gap line replaces the previous static `content.explanation` block
 * — that one just restated the question's requirements; this one names
 * what the user's submission specifically failed to do. Comes from the
 * Evaluator at submission time. Empty for fully correct answers.
 *
 * Streaming mode (added with the SSE submit endpoint): when the parent
 * passes a `streaming` prop, the card renders the partial `feedback`
 * and `gap` text live as the Evaluator emits snapshots, with a blinking
 * caret to signal "still typing". The verdict tile, score, and tag
 * recap stay hidden until the stream completes — those fields tend to
 * land near the end of the model's structured-output JSON and look
 * jarring if they snap in mid-sentence.
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import type { ExerciseContent, ExerciseFeedback } from "@/lib/api";
import { colors } from "@/lib/theme";

import { feedbackCardStyles as styles } from "./FeedbackCard.styles";

type Tone = { icon: string; label: string; bg: string; fg: string };

function toneFor(verdict: ExerciseFeedback["verdict"]): Tone {
  if (verdict === "correct") {
    return {
      icon: "🎉",
      label: "Correct!",
      bg: colors.successSoft,
      fg: colors.success,
    };
  }
  if (verdict === "incorrect") {
    return {
      icon: "💪",
      label: "Not quite",
      bg: colors.dangerSoft,
      fg: colors.danger,
    };
  }
  if (verdict === "reviewed") {
    return {
      icon: "🔁",
      label: "Reviewed",
      bg: colors.infoSoft,
      fg: colors.info,
    };
  }
  return {
    icon: "📝",
    label: "Partial",
    bg: colors.warningSoft,
    fg: colors.warning,
  };
}

// Neutral "still scoring" tone used while streaming. The verdict isn't
// trustworthy mid-stream so we deliberately avoid the green/red palette.
const STREAMING_TONE: Tone = {
  icon: "✍️",
  label: "Scoring",
  bg: colors.infoSoft,
  fg: colors.info,
};

/** Blinking caret rendered at the end of streaming text fields. */
function StreamingCaret({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.Text
      style={{
        opacity,
        color,
        fontSize: 14,
        fontWeight: "800",
        lineHeight: 20,
      }}
    >
      {" ▍"}
    </Animated.Text>
  );
}

export function FeedbackCard({
  feedback,
  content: _content,
  streaming,
}: {
  feedback: ExerciseFeedback;
  content: ExerciseContent;
  /**
   * Optional partial Evaluator output. When present the card renders in
   * "streaming" mode: it shows whatever `feedback` / `gap` text has
   * arrived so far with a blinking caret, and hides the score / verdict
   * / tag blocks until the stream completes (signalled by the parent
   * dropping this prop).
   */
  streaming?: { feedback?: string; gap?: string };
}) {
  // Pick the tone: while streaming we don't trust verdict yet, so use a
  // neutral palette. Once the parent drops the `streaming` prop we fall
  // back to the verdict-driven tone.
  const isStreaming = streaming !== undefined;
  const tone = isStreaming ? STREAMING_TONE : toneFor(feedback.verdict);

  const liveFeedback = isStreaming
    ? (streaming?.feedback ?? "").trim()
    : (feedback.feedback ?? "").trim();
  const liveGap = isStreaming
    ? (streaming?.gap ?? "").trim()
    : (feedback.gap ?? "").trim();

  // Persist the last text we've seen so the card doesn't flash empty if
  // a particular snapshot drops a key (some SDK versions emit deltas
  // with only the most recent field). Kept inside the component because
  // it's a render-only smoothing concern.
  const [shownFeedback, setShownFeedback] = useState(liveFeedback);
  const [shownGap, setShownGap] = useState(liveGap);
  useEffect(() => {
    if (liveFeedback.length >= shownFeedback.length) {
      setShownFeedback(liveFeedback);
    }
  }, [liveFeedback, shownFeedback.length]);
  useEffect(() => {
    if (liveGap.length >= shownGap.length) {
      setShownGap(liveGap);
    }
  }, [liveGap, shownGap.length]);

  return (
    <View style={[styles.card, { backgroundColor: tone.bg }]}>
      <View style={styles.header}>
        <View style={styles.verdictRow}>
          <Text style={styles.icon}>{tone.icon}</Text>
          <Text style={[styles.verdict, { color: tone.fg }]}>
            {tone.label}
          </Text>
        </View>
        {isStreaming ? null : (
          <Text style={[styles.score, { color: tone.fg }]}>
            {Math.round((feedback.score ?? 0) * 100)}%
          </Text>
        )}
      </View>
      <Text style={styles.body}>
        {shownFeedback}
        {isStreaming && shownGap.length === 0 ? (
          <StreamingCaret color={tone.fg} />
        ) : null}
      </Text>
      {shownGap.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>Where it fell short</Text>
          <Text style={styles.body}>
            {shownGap}
            {isStreaming ? <StreamingCaret color={tone.fg} /> : null}
          </Text>
        </View>
      ) : null}
      {!isStreaming && feedback.weak_areas.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>To revisit</Text>
          {feedback.weak_areas.map((w, i) => (
            <Text key={i} style={styles.body}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}
      {!isStreaming && feedback.next_focus ? (
        <View style={styles.block}>
          <Text style={styles.label}>Next focus</Text>
          <Text style={styles.body}>{feedback.next_focus}</Text>
        </View>
      ) : null}
    </View>
  );
}
