/**
 * Flashcard exercise body. Tap-to-flip animation with two faces, then
 * a hard/medium/easy self-rating that submits the result.
 */
import { useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";

import type { ExerciseContent, ExerciseRow } from "@/lib/api";
import { Gradient } from "@/components/Gradient";
import { spacing, typeAccent } from "@/lib/theme";

import { flashcardStyles as styles } from "./Flashcard.styles";

const RATING_BUTTONS = [
  { r: "hard", label: "Hard", emoji: "😅", from: "#fb7185", to: "#e11d48" },
  { r: "medium", label: "Medium", emoji: "🤔", from: "#fbbf24", to: "#d97706" },
  { r: "easy", label: "Easy", emoji: "😎", from: "#86efac", to: "#16a34a" },
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
  const accent = typeAccent.flashcard;

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

  // Front face: 0deg → 180deg
  const frontStyle = {
    transform: [
      {
        rotateY: flip.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
    opacity: flip.interpolate({
      inputRange: [0, 0.5, 0.5001, 1],
      outputRange: [1, 1, 0, 0],
    }),
  };
  // Back face: 180deg → 360deg
  const backStyle = {
    transform: [
      {
        rotateY: flip.interpolate({
          inputRange: [0, 1],
          outputRange: ["180deg", "360deg"],
        }),
      },
    ],
    opacity: flip.interpolate({
      inputRange: [0, 0.4999, 0.5, 1],
      outputRange: [0, 0, 1, 1],
    }),
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        style={styles.wrap}
        accessibilityRole="button"
        accessibilityLabel={revealed ? "Show front" : "Reveal answer"}
      >
        <Animated.View style={[styles.face, frontStyle]}>
          <Gradient
            from={accent.gradientFrom}
            to={accent.gradientTo}
            angle={140}
            style={styles.gradient}
          >
            <View style={styles.corner}>
              <Text style={styles.cornerText}>FRONT</Text>
            </View>
            <Text style={styles.emoji}>🃏</Text>
            <Text style={styles.text}>{content.front}</Text>
            <View style={styles.hintRow}>
              <Text style={styles.hint}>Tap to reveal →</Text>
            </View>
          </Gradient>
        </Animated.View>

        <Animated.View
          style={[styles.face, styles.faceAbs, backStyle]}
          pointerEvents={revealed ? "auto" : "none"}
        >
          <Gradient
            from="#ffffff"
            to="#f4eefe"
            angle={150}
            style={[styles.gradient, styles.back]}
          >
            <View style={[styles.corner, styles.cornerLight]}>
              <Text style={[styles.cornerText, styles.cornerTextLight]}>
                BACK
              </Text>
            </View>
            <Text style={styles.emojiLight}>💡</Text>
            <Text style={styles.textDark}>{content.back}</Text>
            <View style={styles.hintRow}>
              <Text style={styles.hintDark}>Tap to flip back</Text>
            </View>
          </Gradient>
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
                    disabled && !active && styles.ratingBtnFaded,
                    pressed && !disabled && styles.ratingBtnPressed,
                  ]}
                >
                  {active ? (
                    <Gradient
                      from={b.from}
                      to={b.to}
                      angle={135}
                      style={styles.ratingBtnGradient}
                    >
                      <Text style={styles.ratingEmoji}>{b.emoji}</Text>
                      <Text style={styles.ratingTextActive}>{b.label}</Text>
                    </Gradient>
                  ) : (
                    <View style={styles.ratingBtnInner}>
                      <Text style={styles.ratingEmoji}>{b.emoji}</Text>
                      <Text style={styles.ratingText}>{b.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
