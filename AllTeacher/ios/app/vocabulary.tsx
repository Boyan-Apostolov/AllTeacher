/**
 * Vocabulary Bank — browse, search and practice words extracted from
 * lessons and exercises. Buttons are wired to UI state only for now;
 * backend integration comes in a follow-up iteration.
 */
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer, Toolbar } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { colors } from "@/lib/theme";
import { vocabStyles as styles } from "./vocabulary.styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type FilterTab = "all" | "review" | "mastered";

interface VocabWord {
  id: string;
  target: string;      // word in the language being learned
  native: string;      // translation in user's native language
  example?: string;    // example sentence
  difficulty: Difficulty;
  mastery: number;     // 0–100
  curriculum: string;  // which curriculum this came from
  emoji: string;
}

// ─── Mock data (replaced by API call in follow-up) ───────────────────────────

const MOCK_WORDS: VocabWord[] = [
  {
    id: "1",
    target: "het huis",
    native: "the house",
    example: "Ik woon in een groot huis.",
    difficulty: "easy",
    mastery: 85,
    curriculum: "Dutch A1",
    emoji: "🏠",
  },
  {
    id: "2",
    target: "vliegtuig",
    native: "airplane",
    example: "Het vliegtuig vertrekt om drie uur.",
    difficulty: "medium",
    mastery: 40,
    curriculum: "Dutch A1",
    emoji: "✈️",
  },
  {
    id: "3",
    target: "de bibliotheek",
    native: "the library",
    example: "Ik lees een boek in de bibliotheek.",
    difficulty: "medium",
    mastery: 60,
    curriculum: "Dutch A1",
    emoji: "📚",
  },
  {
    id: "4",
    target: "vertrouwen",
    native: "to trust / confidence",
    example: "Ik vertrouw op mijn vrienden.",
    difficulty: "hard",
    mastery: 15,
    curriculum: "Dutch A1",
    emoji: "🤝",
  },
  {
    id: "5",
    target: "gezellig",
    native: "cozy / convivial",
    example: "Het café is heel gezellig.",
    difficulty: "hard",
    mastery: 10,
    curriculum: "Dutch A1",
    emoji: "☕",
  },
  {
    id: "6",
    target: "de fiets",
    native: "the bicycle",
    example: "Ik ga naar school op de fiets.",
    difficulty: "easy",
    mastery: 95,
    curriculum: "Dutch A1",
    emoji: "🚲",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const difficultyColor: Record<Difficulty, { bg: string; fg: string }> = {
  easy:   { bg: colors.okSoft,    fg: colors.ok },
  medium: { bg: colors.amberSoft, fg: colors.amber },
  hard:   { bg: colors.warnSoft,  fg: colors.warn },
};

const masteryColor = (pct: number) => {
  if (pct >= 80) return colors.ok;
  if (pct >= 40) return colors.amber;
  return colors.warn;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function WordCard({ word }: { word: VocabWord }) {
  const diff = difficultyColor[word.difficulty];

  const onPractice = () =>
    Alert.alert("Practice", `Practice "${word.target}" — coming soon!`);

  const onToggleMastered = () =>
    Alert.alert(
      word.mastery >= 80 ? "Mark for review" : "Mark as mastered",
      `Update mastery for "${word.target}" — coming soon!`,
    );

  return (
    <View style={styles.wordCard}>
      <View style={styles.wordCardTop}>
        <Text style={styles.wordEmoji}>{word.emoji}</Text>
        <View style={styles.wordBody}>
          <Text style={styles.wordTarget}>{word.target}</Text>
          <Text style={styles.wordNative}>{word.native}</Text>
          {word.example ? (
            <Text style={styles.wordExample}>"{word.example}"</Text>
          ) : null}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: diff.bg, borderColor: diff.fg }]}>
              <Text style={[styles.badgeText, { color: diff.fg }]}>
                {word.difficulty}
              </Text>
            </View>
            <Sticker
              bg={colors.paperAlt}
              color={colors.ink3}
              rotate={0}
              style={{ paddingVertical: 2, paddingHorizontal: 7 }}
              textStyle={{ fontSize: 9 }}
              uppercase={false}
            >
              {word.curriculum}
            </Sticker>
          </View>
        </View>
      </View>

      {/* Mastery bar */}
      <View style={styles.masteryRow}>
        <View style={styles.masteryTrack}>
          <View
            style={[
              styles.masteryFill,
              {
                width: `${word.mastery}%` as any,
                backgroundColor: masteryColor(word.mastery),
              },
            ]}
          />
        </View>
        <Text style={styles.masteryPct}>{word.mastery}%</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.wordActions}>
        <Pressable
          style={[styles.wordBtn, styles.wordBtnPrimary]}
          onPress={onPractice}
        >
          <Text style={styles.wordBtnText}>🎯 Practice</Text>
        </Pressable>
        <Pressable
          style={[styles.wordBtn, styles.wordBtnSecondary]}
          onPress={onToggleMastered}
        >
          <Text style={styles.wordBtnText}>
            {word.mastery >= 80 ? "📌 Review again" : "✓ Mark mastered"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VocabularyBank() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const goHome = () => router.replace("/");

  const handleAddWord = () =>
    Alert.alert("Add word", "Manual word entry — coming soon!");

  const handlePracticeAll = () =>
    Alert.alert("Practice all", "Full vocabulary drill session — coming soon!");

  // Filter
  const filtered = MOCK_WORDS.filter((w) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      w.target.toLowerCase().includes(q) ||
      w.native.toLowerCase().includes(q);
    const matchesTab =
      activeFilter === "all" ||
      (activeFilter === "mastered" && w.mastery >= 80) ||
      (activeFilter === "review" && w.mastery < 80);
    return matchesQuery && matchesTab;
  });

  const totalWords = MOCK_WORDS.length;
  const masteredCount = MOCK_WORDS.filter((w) => w.mastery >= 80).length;
  const reviewCount = MOCK_WORDS.filter((w) => w.mastery < 80).length;

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: `All (${totalWords})` },
    { id: "review", label: `To review (${reviewCount})` },
    { id: "mastered", label: `Mastered (${masteredCount})` },
  ];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar title="Vocabulary" onBack={goBack} onHome={goHome} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Your word bank</Text>
          <Text style={styles.heroTitle}>Vocabulary 📖</Text>
          <Text style={styles.heroSubtitle}>
            Words collected from your lessons and exercises — search, drill, and
            track mastery over time.
          </Text>
        </View>

        {/* ── Stats strip ── */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{totalWords}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statNum, { color: colors.ok }]}>
              {masteredCount}
            </Text>
            <Text style={styles.statLabel}>Mastered</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statNum, { color: colors.amber }]}>
              {reviewCount}
            </Text>
            <Text style={styles.statLabel}>To review</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search words…"
            placeholderTextColor={colors.ink4}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Filter tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              style={[
                styles.filterTab,
                activeFilter === t.id && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(t.id)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === t.id && styles.filterTabTextActive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Practice-all banner ── */}
        {reviewCount > 0 && activeFilter !== "mastered" ? (
          <View style={styles.practiceBanner}>
            <View style={styles.practiceBannerTop}>
              <Text style={styles.practiceBannerEmoji}>🧠</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.practiceBannerTitle}>
                  {reviewCount} word{reviewCount !== 1 ? "s" : ""} to review
                </Text>
                <Text style={styles.practiceBannerSub}>
                  Run a focused drill on your weakest words.
                </Text>
              </View>
            </View>
            <Pressable style={styles.practiceAllBtn} onPress={handlePracticeAll}>
              <Text style={styles.practiceAllText}>Practice all →</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Word list ── */}
        <Text style={styles.sectionLabel}>
          {filtered.length} word{filtered.length !== 1 ? "s" : ""}
        </Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>
              {query ? "🔍" : "🌱"}
            </Text>
            <Text style={styles.emptyTitle}>
              {query ? "No matches" : "No words yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {query
                ? `Nothing matched "${query}". Try a different search.`
                : "Words are added automatically as you complete lessons and exercises. You can also add them manually below."}
            </Text>
          </View>
        ) : (
          <View style={styles.wordList}>
            {filtered.map((w) => (
              <WordCard key={w.id} word={w} />
            ))}
          </View>
        )}

        {/* ── Add word CTA ── */}
        <Pressable style={styles.addWordBtn} onPress={handleAddWord}>
          <Text style={{ fontSize: 18 }}>＋</Text>
          <Text style={styles.addWordText}>Add a word manually</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
