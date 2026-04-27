/**
 * Horizontal scroll of preset language chips + a free-form text input
 * for codes the chips don't cover. Used when creating a new curriculum
 * to set the user's native language.
 */
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/lib/theme";

import { languagePickerStyles as styles } from "./LanguagePicker.styles";

export type LanguageOption = {
  code: string;
  label: string;
  flag: string;
};

export const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

export function LanguagePicker({
  value,
  onChange,
  disabled,
  detectedHint,
  languages = DEFAULT_LANGUAGES,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** Optional caption like "Detected from your device: en". */
  detectedHint?: string;
  languages?: LanguageOption[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {languages.map((l) => {
          const active = l.code === value;
          return (
            <Pressable
              key={l.code}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(l.code)}
              disabled={disabled}
            >
              <Text style={styles.chipFlag}>{l.flag}</Text>
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                ]}
              >
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        style={styles.input}
        placeholder="or type a code: sv, el, vi…"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
      />
      {detectedHint ? (
        <Text style={styles.hint}>{detectedHint}</Text>
      ) : null}
    </View>
  );
}
