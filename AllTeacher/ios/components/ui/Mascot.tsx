/**
 * Owl mascot — AllTeacher's character. Moods: happy | thinking | cheer | sleepy | wink.
 * Rendered as an SVG via react-native-svg (already in deps via expo).
 * Falls back to a simple emoji if SVG isn't available.
 */
import React from "react";
import { View, Text } from "react-native";

// Lazy-require react-native-svg so the app doesn't crash if it's not installed.
let Svg: any, Circle: any, Path: any, Ellipse: any, G: any;
try {
  const rnsvg = require("react-native-svg");
  Svg = rnsvg.Svg;
  Circle = rnsvg.Circle;
  Path = rnsvg.Path;
  Ellipse = rnsvg.Ellipse;
  G = rnsvg.G;
} catch (_) {
  // SVG not available — use emoji fallback
}

type Mood = "happy" | "thinking" | "cheer" | "sleepy" | "wink";

interface MascotProps {
  size?: number;
  mood?: Mood;
  color?: string;
}

export function Mascot({ size = 56, mood = "happy", color = "#FF6B3D" }: MascotProps) {
  if (!Svg) {
    const moodEmoji: Record<Mood, string> = {
      happy: "🦉", thinking: "🤔", cheer: "🎉", sleepy: "😴", wink: "😉",
    };
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: size * 0.7 }}>{moodEmoji[mood]}</Text>
      </View>
    );
  }

  const isClosedEye = mood === "sleepy" || mood === "wink";
  const isWink = mood === "wink";
  const eyeR = mood === "cheer" ? 1.7 : 2.1;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* ear tufts */}
      <Path d="M14 22 L18 10 L22 22 Z" fill={color} stroke="#1A1410" strokeWidth="1.6" strokeLinejoin="round" />
      <Path d="M50 22 L46 10 L42 22 Z" fill={color} stroke="#1A1410" strokeWidth="1.6" strokeLinejoin="round" />
      {/* body */}
      <Ellipse cx="32" cy="38" rx="22" ry="22" fill={color} stroke="#1A1410" strokeWidth="2" />
      {/* belly */}
      <Ellipse cx="32" cy="42" rx="13" ry="14" fill="#FBF4E6" />
      {/* eye discs */}
      <Circle cx="24" cy="30" r="7" fill="#FBF4E6" stroke="#1A1410" strokeWidth="1.5" />
      <Circle cx="40" cy="30" r="7" fill="#FBF4E6" stroke="#1A1410" strokeWidth="1.5" />
      {/* left eye */}
      {isClosedEye ? (
        <Path d="M21 30 Q24 27.5 27 30" stroke="#1A1410" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <Circle cx="24" cy="30" r={eyeR} fill="#1A1410" />
      )}
      {/* right eye */}
      {isWink ? (
        <Circle cx="40" cy="30" r={eyeR} fill="#1A1410" />
      ) : isClosedEye ? (
        <Path d="M37 30 Q40 27.5 43 30" stroke="#1A1410" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <Circle cx="40" cy="30" r={eyeR} fill="#1A1410" />
      )}
      {/* beak */}
      <Path d="M29 35 L35 35 L32 40 Z" fill="#FFB020" stroke="#1A1410" strokeWidth="1.4" strokeLinejoin="round" />
      {/* wing hints */}
      <Path d="M14 38 Q18 44 14 50" stroke="#1A1410" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M50 38 Q46 44 50 50" stroke="#1A1410" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* feet */}
      <Path d="M26 58 l-2 3 M28 58 l0 3 M30 58 l2 3" stroke="#FFB020" strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M34 58 l-2 3 M36 58 l0 3 M38 58 l2 3" stroke="#FFB020" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
