/**
 * Video comprehension exercise body.
 *
 * Uses react-native-youtube-iframe which implements the YouTube IFrame
 * Player API in a properly-configured WebView. This is the only reliable
 * way to embed YouTube in-app on iOS without error 150/152/153.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { spacing } from "@/lib/theme";

import { multipleChoiceStyles as mcStyles } from "./MultipleChoice.styles";
import { videoChoiceStyles as styles } from "./VideoChoice.styles";

function extractVideoId(url: string): string | null {
  const embedMatch = url.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
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
  const videoUrl = content.video_url as string | undefined;
  const prompt = content.prompt || "";
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;
  const [hasWatched, setHasWatched] = useState(false);

  const chosen =
    submission && "choice_index" in submission
      ? (submission as { choice_index: number }).choice_index
      : null;
  const correct = content.correct_index;
  const optionsUnlocked = hasWatched || disabled;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* ── YouTube player ── */}
      {videoId ? (
        <View style={styles.videoCard}>
          <YoutubePlayer
            height={210}
            videoId={videoId}
            play={false}
            webViewProps={{
              allowsFullscreenVideo: true,
              allowsInlineMediaPlayback: true,
            }}
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
        <View style={styles.noVideoCard}>
          <Text style={styles.noVideoIcon}>🎬</Text>
          <Text style={styles.noVideoText}>Video unavailable for this exercise.</Text>
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
      {prompt ? <Text style={styles.promptText}>{prompt}</Text> : null}

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
                  {showCorrect ? "✓" : showWrong ? "✕" : String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={mcStyles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
        {!optionsUnlocked ? (
          <Text style={styles.lockHint}>Watch the video first, then pick your answer.</Text>
        ) : null}
      </View>
    </View>
  );
}

export default VideoChoice;
