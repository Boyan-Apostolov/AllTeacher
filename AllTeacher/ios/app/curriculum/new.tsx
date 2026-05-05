/**
 * New Curriculum screen — neo-brutalist redesign.
 * Goal text area + suggestion stickers + language picker.
 */
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LanguagePicker } from "@/components/curriculum";
import { MessageBox, PrimaryCta, Toolbar } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { colors } from "@/lib/theme";

import { newCurriculumStyles as styles } from "./new.styles";

function detectLanguage(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc) return loc.split("-")[0].toLowerCase();
  } catch {}
  if (Platform.OS === "ios") {
    const s = NativeModules.SettingsManager?.settings;
    const raw: string | undefined = s?.AppleLocale || s?.AppleLanguages?.[0];
    if (raw) return raw.split(/[-_]/)[0].toLowerCase();
  }
  return "en";
}

const SUGGESTIONS: [string, string, string, number][] = [
  ["🇪🇸 Spanish basics", colors.brand, "#fff", -2],
  ["🎸 Guitar chords", colors.flash, "#fff", 1],
  ["📐 Calculus prep", colors.mc, "#fff", -1],
  ["✍️ Better writing", "#FFE066", colors.ink, 2],
  ["🧠 Spaced repetition", colors.paperAlt, colors.ink, -1],
  ["🍳 Knife skills", colors.short, colors.ink, 1],
];

export default function NewCurriculumScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const defaultLang = useMemo(detectLanguage, []);
  const [goal, setGoal] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState(defaultLang);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const token = session?.access_token;
    if (!token) { setError("Not signed in"); return; }
    const trimmed = goal.trim();
    if (!trimmed) { setError("Tell us what you want to learn first."); return; }
    const lang = (nativeLanguage || "en").trim().toLowerCase();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createCurriculum(token, { goal: trimmed, native_language: lang });
      router.replace(`/curriculum/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.body?.error === "tier_curriculum_cap") {
        Alert.alert(
          "Plan limit reached",
          e.body.detail || "Your plan supports a limited number of active curricula. Archive an existing track or upgrade to start a new one.",
          [{ text: "OK" }],
        );
      } else {
        setError((e as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => router.canGoBack() ? router.back() : router.replace("/");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar title="New curriculum" onBack={goBack} disabled={submitting} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Heading */}
          <View style={{ marginTop: 12 }}>
            <Sticker bg={colors.ink} color="#fff" rotate={-2}>step 2 of 3</Sticker>
            <Text style={[styles.title, { marginTop: 16 }]}>
              What do you{"\n"}
              <Text style={styles.titleAccent}>want to learn?</Text>
            </Text>
            <Text style={[styles.subtitle, { marginTop: 12 }]}>
              Anything goes. We'll figure out the path.
            </Text>
          </View>

          {/* Goal text area */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Your goal</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Conversational Spanish for a 2-week trip to Mexico City"
              placeholderTextColor={colors.ink4}
              multiline
              autoFocus
              value={goal}
              onChangeText={setGoal}
              editable={!submitting}
              maxLength={200}
            />
            <Text style={styles.charCount}>{goal.length} / 200</Text>
          </View>

          {/* Suggestions */}
          <View>
            <Text style={styles.suggestionsLabel}>Or pick one</Text>
            <View style={styles.suggestionsWrap}>
              {SUGGESTIONS.map(([txt, bg, fg, rot]) => (
                <Pressable key={txt} onPress={() => setGoal(txt.replace(/^[\p{Emoji_Presentation}\s]+/u, "").trim())} disabled={submitting}>
                  <Sticker bg={bg} color={fg} rotate={rot} uppercase={false} style={{ paddingVertical: 7, paddingHorizontal: 12 }} textStyle={{ fontSize: 12 }}>
                    {txt}
                  </Sticker>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Language */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Your native language</Text>
            <Text style={styles.fieldHint}>Questions and feedback will arrive in this language.</Text>
            <LanguagePicker
              value={nativeLanguage}
              onChange={setNativeLanguage}
              disabled={submitting}
              detectedHint={`Detected: ${defaultLang}`}
            />
          </View>

          {error ? <MessageBox variant="error" message={error} /> : null}

          <PrimaryCta
            label="Start the quiz →"
            onPress={start}
            loading={submitting}
            disabled={submitting}
            bg={colors.brand}
          />

          <Pressable style={styles.cancel} onPress={goBack} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
