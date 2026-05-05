/**
 * Flashcard exercise body — neo-brutalist redesign.
 * Both card faces are absolutely positioned inside the wrap frame
 * (border/shadow on wrap only, overflow:hidden clips to borderRadius).
 */
import { useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";

import { flashcardStyles as styles } from "./Flashcard.styles";

const RATING_BUTTONS = [
  { r: "hard",   label: "Hard",   emoji: "😅", bg: colors.warn },
  { r: "medium", label: "Medium", emoji: "🤔", bg: colors.short },
  { r: "easy",   label: "Easy",   emoji: "😎", bg: colors.ok },
] as const;

export function Flashcard({
  content,
  submission,
  disabled,
  onRate,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onRate: (rating: "easy" | "medium" | "hard") => void;
}) {
  const initial = Boolean(submission && "self_rating" in submission);
  const [revealed, setRevealed] = useState(initial);
  const flip = useRef(new Animated.Value(initial ? 1 : 0)).current;

  const chosenRating =
    submission && "self_rating" in submission ? submission.self_rating : null;

  const animateFlip = (toRevealed: boolean) => {
    Animated.timing(flip, {
      toValue: toRevealed ? 1 : 0,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const toggle = () => {
    if (disabled) return;
    const r = !revealed;
    setRevealed(r);
    animateFlip(r);
  };

  const frontRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.4999, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        style={styles.wrap}
        accessibilityRole="button"
        accessibilityLabel={revealed ? "Show front" : "Reveal answer"}
      >
        {/* Front face */}
        <Animated.View
          style={[
            styles.face,
            styles.frontBg,
            { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
          ]}
        >
          <View style={styles.faceInner}>
            <View style={styles.corner}>
              <Text style={styles.cornerText}>FRONT</Text>
            </View>
            <Text style={styles.emoji}>🃏</Text>
            <Text style={styles.text}>{content.front}</Text>
            <View style={styles.hintRow}>
              <Text style={styles.hint}>TAP TO REVEAL →</Text>
            </View>
          </View>
        </Animated.View>

        {/* Back face */}
        <Animated.View
          style={[
            styles.face,
            styles.backBg,
            { transform: [{ rotateY: backRotate }], opacity: backOpacity },
          ]}
          pointerEvents={revealed ? "auto" : "none"}
        >
          <View style={styles.faceInner}>
            <View style={[styles.corner, styles.cornerLight]}>
              <Text style={[styles.cornerText, styles.cornerTextLight]}>BACK</Text>
            </View>
            <Text style={styles.emojiLight}>💡</Text>
            <Text style={styles.textDark}>{content.back}</Text>
            <View style={styles.hintRow}>
              <Text style={styles.hintDark}>Tap to flip back</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>

      {revealed ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.ratingPrompt}>How well did you know this?</Text>
          <View style={styles.ratingRow}>
            {RATING_BUTTONS.map((b) => {
              const active = chosenRating === b.r;
              return (
                <Pressable
                  key={b.r}
                  onPress={() => onRate(b.r)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.ratingBtn,
                    active && { backgroundColor: b.bg },
                    disabled && !active && styles.ratingBtnFaded,
                    pressed && !disabled && styles.ratingBtnPressed,
                  ]}
                >
                  <View style={active ? styles.ratingBtnActive : styles.ratingBtnInner}>
                    <Text style={styles.ratingEmoji}>{b.emoji}</Text>
                    <Text style={[styles.ratingText, active && styles.ratingTextActive]}>
                      {b.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
