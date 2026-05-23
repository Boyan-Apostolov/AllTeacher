/**
 * Video comprehension exercise body.
 *
 * Shows a YouTube thumbnail. Tapping opens the video in a native Safari
 * sheet (SFSafariViewController on iOS) via expo-web-browser — the sheet
 * slides up inside the app so the user never leaves. This avoids all
 * YouTube embedding errors (150/152/153) which occur regardless of the
 * videoEmbeddable API filter.
 */
import * as WebBrowser from "expo-web-browser";
import { Image, Pressable, Text, View } from "react-native";

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
  const thumbnailUri = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  const chosen =
    submission && "choice_index" in submission
      ? (submission as { choice_index: number }).choice_index
      : null;
  const correct = content.correct_index;

  function openVideo() {
    if (!videoId) return;
    WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${videoId}`, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: "#FF0000",
    });
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {/* ── Video thumbnail card ── */}
      {videoId ? (
        <Pressable
          style={({ pressed }) => [
            styles.videoCard,
            pressed && styles.videoCardPressed,
          ]}
          onPress={openVideo}
        >
          {thumbnailUri ? (
            <Image
              source={{ uri: thumbnailUri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <Text style={styles.thumbnailFallbackIcon}>🎬</Text>
            </View>
          )}
          {/* Red play button overlay */}
          <View style={styles.videoOverlay}>
            <View style={styles.playBtn}>
              <Text style={styles.playBtnIcon}>▶</Text>
            </View>
          </View>
          <View style={styles.videoFooter}>
            <Text style={styles.videoLabel}>🎬 Watch & answer</Text>
            <Text style={styles.videoHint}>Tap to watch</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.noVideoCard}>
          <Text style={styles.noVideoIcon}>🎬</Text>
          <Text style={styles.noVideoText}>Video unavailable for this exercise.</Text>
        </View>
      )}

      {/* ── Comprehension question ── */}
      {prompt ? (
        <Text style={styles.promptText}>{prompt}</Text>
      ) : null}

      {/* ── Options — always unlocked, user watches at their own pace ── */}
      <View style={{ gap: spacing.sm }}>
        {(content.options ?? []).map((opt, idx) => {
          const isChosen = chosen === idx;
          const showCorrect = disabled && correct === idx;
          const showWrong = disabled && isChosen && correct !== idx;
          return (
            <Pressable
              key={`${idx}-${opt}`}
              style={({ pressed }) => [
                mcStyles.option,
                isChosen && mcStyles.optionChosen,
                showCorrect && mcStyles.optionCorrect,
                showWrong && mcStyles.optionWrong,
                disabled && !isChosen && !showCorrect && mcStyles.optionFaded,
                pressed && !disabled && mcStyles.optionPressed,
              ]}
              onPress={() => onPick(idx)}
              disabled={disabled}
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
      </View>
    </View>
  );
}

export default VideoChoice;
