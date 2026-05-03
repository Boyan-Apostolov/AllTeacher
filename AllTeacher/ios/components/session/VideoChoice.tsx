/**
 * Video comprehension exercise body.
 *
 * Shows a YouTube embed via WebView, then unlocks multiple-choice
 * options once the user marks "I've watched it". Mirrors the pattern
 * established by ListenChoice: media first, MCQ second.
 *
 * The YouTube embed URL is stored in `content.video_url` — resolved by
 * the orchestrator via the YouTube Data API v3 from the Writer's
 * `video_query` field before the row is inserted.
 *
 * Submission shape is identical to multiple_choice: `{ choice_index }`.
 * The Evaluator + scoring path are therefore unchanged — video_choice
 * is just MCQ with a video preamble instead of a text prompt.
 *
 * react-native-webview is loaded lazily (same pattern as expo-av in
 * ListenChoice) so this file type-checks even before the package
 * is installed.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { spacing } from "@/lib/theme";

import { multipleChoiceStyles as mcStyles } from "./MultipleChoice.styles";
import { videoChoiceStyles as styles } from "./VideoChoice.styles";

// Lazy-load WebView — same guard pattern as expo-av in ListenChoice.
let _WebView: any = null;
try {
  _WebView = require("react-native-webview").WebView;
} catch {
  _WebView = null;
}

export function VideoChoice({
  content,
  submission,
  disabled,
  onPick,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onPick: (idx: number) => void;
}) {
  const videoUrl = content.video_url;
  const prompt = content.prompt || "";
  const [hasWatched, setHasWatched] = useState(false);

  const chosen =
    submission && "choice_index" in submission
      ? submission.choice_index
      : null;
  const correct = content.correct_index;
  const optionsUnlocked = hasWatched || disabled;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* ── Video embed ── */}
      {videoUrl && _WebView ? (
        <View style={styles.videoCard}>
          <_WebView
            style={styles.webview}
            source={{ uri: videoUrl }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
          />
          <View style={styles.videoFooter}>
            <Text style={styles.videoLabel}>🎬 Watch & answer</Text>
            {hasWatched || disabled ? (
              <View style={styles.watchedBadge}>
                <Text style={styles.watchedBadgeText}>✓ Watched</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        /* Fallback when WebView isn't installed or no URL was resolved */
        <View style={styles.noVideoCard}>
          <Text style={styles.noVideoIcon}>🎬</Text>
          <Text style={styles.noVideoText}>
            {videoUrl
              ? "Video player unavailable — install react-native-webview."
              : "Video unavailable for this exercise."}
          </Text>
        </View>
      )}

      {/* ── "I've watched it" gate ── */}
      {!hasWatched && !disabled ? (
        <View style={styles.watchCtaRow}>
          <Pressable
            style={({ pressed }) => [
              styles.watchCta,
              pressed && styles.watchCtaPressed,
            ]}
            onPress={() => setHasWatched(true)}
          >
            <Text style={styles.watchCtaIcon}>👁</Text>
            <Text style={styles.watchCtaText}>I've watched it</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Comprehension question ── */}
      {prompt ? (
        <Text style={styles.promptText}>{prompt}</Text>
      ) : null}

      {/* ── Options ── */}
      <View style={{ gap: spacing.sm, opacity: optionsUnlocked ? 1 : 0.4 }}>
        {(content.options ?? []).map((opt, idx) => {
          const isChosen = chosen === idx;
          const showCorrect = disabled && correct === idx;
          const showWrong = disabled && isChosen && correct !== idx;
          const blocked = !optionsUnlocked || disabled;
          return (
            <Pressable
              key={`${idx}-${opt}`}
              style={({ pressed }) => [
                mcStyles.option,
                isChosen && mcStyles.optionChosen,
                showCorrect && mcStyles.optionCorrect,
                showWrong && mcStyles.optionWrong,
                disabled && !isChosen && !showCorrect && mcStyles.optionFaded,
                pressed && !blocked && mcStyles.optionPressed,
              ]}
              onPress={() => onPick(idx)}
              disabled={blocked}
            >
              <View
                style={[
                  mcStyles.optionDot,
                  showCorrect && mcStyles.optionDotCorrect,
                  showWrong && mcStyles.optionDotWrong,
                ]}
              >
                <Text
                  style={[
                    mcStyles.optionDotText,
                    (showCorrect || showWrong) && mcStyles.optionDotTextOnAccent,
                  ]}
                >
                  {showCorrect
                    ? "✓"
                    : showWrong
                      ? "✕"
                      : String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={mcStyles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
        {!optionsUnlocked ? (
          <Text style={styles.lockHint}>
            Watch the video first, then pick your answer.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default VideoChoice;
