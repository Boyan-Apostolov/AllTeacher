/**
 * Audio comprehension exercise body.
 *
 * Plays the TTS-generated audio clip from `content.audio_url`, then
 * unlocks the multiple-choice options. The user can replay the clip
 * any number of times — many real listening exercises ask the user to
 * pick out something they need to hear twice. We deliberately AUTO-PLAY
 * once on mount: the play-button-to-options flow makes the user wait
 * twice (tap play, then tap an option) which feels clumsy on a phone.
 *
 * Submission shape matches MultipleChoice: `{ choice_index: number }`
 * — listen_choice is a multiple-choice exercise with audio framing,
 * not a fundamentally new submission type. So the Evaluator path,
 * scoring, feedback, etc. all reuse what's already there.
 *
 * The expo-av dependency is loaded lazily so this file still
 * type-checks before `npm install` lands the module — same pattern as
 * `react-native-sse` for the streaming submit endpoint.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { spacing } from "@/lib/theme";

import { multipleChoiceStyles as mcStyles } from "./MultipleChoice.styles";
import { listenChoiceStyles as styles } from "./ListenChoice.styles";

// Lazy-load the Audio API. expo-av exports `Audio.Sound.createAsync`
// for playback. The require-with-try is safe to evaluate at module
// load — if the package isn't installed yet the file still imports
// (the component itself just renders an "audio unavailable" notice).
let _Audio: any = null;
try {
  _Audio = require("expo-av").Audio;
} catch {
  _Audio = null;
}

type LoadedSound = {
  unloadAsync: () => Promise<unknown>;
  playAsync: () => Promise<unknown>;
  replayAsync: () => Promise<unknown>;
  setOnPlaybackStatusUpdate: (
    cb: (status: { didJustFinish?: boolean; isPlaying?: boolean }) => void,
  ) => void;
};

export function ListenChoice({
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
  const audioUrl = content.audio_url;
  const promptNative = content.prompt_native || content.prompt || "";
  const chosen =
    submission && "choice_index" in submission
      ? submission.choice_index
      : null;
  const correct = content.correct_index;

  // Playback state. `hasPlayedOnce` gates the options so the user can't
  // peek at the answer before hearing the clip.
  const soundRef = useRef<LoadedSound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Load the sound once, auto-play once, retain the handle for replays.
  // Cleanup on unmount unloads the native sound to avoid the iOS
  // "Audio session interrupted" leak that hits when you stack screens.
  useEffect(() => {
    let cancelled = false;
    if (!_Audio || !audioUrl) {
      // Nothing to load — either the package isn't installed yet (dev
      // path) or the row arrived without a URL (free-tier slip-through
      // — orchestrator should have dropped it but let's be defensive).
      return;
    }
    (async () => {
      try {
        const { sound } = await _Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
        );
        if (cancelled) {
          await sound.unloadAsync().catch(() => undefined);
          return;
        }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate(
          (status: { didJustFinish?: boolean; isPlaying?: boolean }) => {
            if (status.isPlaying != null) setIsPlaying(!!status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setHasPlayedOnce(true);
            }
          },
        );
      } catch (e) {
        if (!cancelled) {
          setAudioError((e as Error).message || "Couldn't load audio");
          // If audio fails outright, unlock the options so the user can
          // still answer using the on-screen text fallback.
          setHasPlayedOnce(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) s.unloadAsync().catch(() => undefined);
    };
  }, [audioUrl]);

  const replay = async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.replayAsync();
    } catch {
      /* swallow — replay errors are not actionable */
    }
  };

  const optionsUnlocked = hasPlayedOnce || disabled;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.audioCard}>
        {promptNative ? (
          <Text style={styles.promptNative}>{promptNative}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            isPlaying && styles.playButtonActive,
            pressed && styles.playButtonPressed,
            !audioUrl && styles.playButtonDisabled,
          ]}
          onPress={replay}
          disabled={!audioUrl || !soundRef.current}
        >
          <Text style={styles.playButtonIcon}>
            {isPlaying ? "🔊" : "▶"}
          </Text>
          <Text style={styles.playButtonLabel}>
            {isPlaying
              ? "Playing…"
              : hasPlayedOnce
                ? "Tap to replay"
                : "Loading…"}
          </Text>
        </Pressable>

        {audioError ? (
          <Text style={styles.audioError}>
            {audioError}. {content.audio_text
              ? "Reading what was said:"
              : ""}
          </Text>
        ) : null}

        {/* Fallback transcript shown ONLY after audio fails — listening
            with the text visible defeats the exercise. */}
        {audioError && content.audio_text ? (
          <Text style={styles.audioTextFallback}>{content.audio_text}</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm, opacity: optionsUnlocked ? 1 : 0.5 }}>
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
            Listen first, then pick the answer.
          </Text>
        ) : null}
      </View>

      {/* Reveal the spoken text post-submission so the user can
          double-check what they heard against what they picked. */}
      {disabled && content.audio_text ? (
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>You heard:</Text>
          <Text style={styles.transcriptText}>{content.audio_text}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default ListenChoice;
