/**
 * Library — domain-agnostic spaced-repetition card bank.
 *
 * Cards are auto-populated from two sources (backend):
 *   1. Completed flashcard exercises (content_json.front / content_json.back)
 *      — upserted in _persist_evaluator_result via _CardsMixin.
 *   2. Key terms tagged by the Explainer agent in lesson summaries (future).
 * Users can also add cards manually via the "Add a card" button.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer, Toolbar } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { useAuth } from "@/lib/auth";
import { api, KnowledgeCard, CreateCardBody } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { vocabStyles as styles } from "./vocabulary.styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type FilterTab = "all" | "due" | "review" | "mastered";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY_ISO = new Date().toISOString();

const isDue = (card: KnowledgeCard) =>
  !!card.next_due && card.next_due <= TODAY_ISO;

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

const uniqueCurricula = (cards: KnowledgeCard[]) => {
  const seen = new Set<string>();
  const list: { id: string; name: string }[] = [];
  for (const c of cards) {
    const key = c.curriculum_id || c.curriculum;
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push({ id: c.curriculum_id || key, name: c.curriculum });
    }
  }
  return list;
};

// ─── Practice modal (flip card + rating) ─────────────────────────────────────

const RATING_BUTTONS = [
  { r: "hard"   as const, label: "Hard",   emoji: "😅", bg: colors.warn },
  { r: "medium" as const, label: "Medium", emoji: "🤔", bg: colors.short },
  { r: "easy"   as const, label: "Easy",   emoji: "😎", bg: colors.ok   },
];

interface PracticeModalProps {
  card: KnowledgeCard | null;
  onClose: () => void;
  onRated: (updated: KnowledgeCard) => void;
  token: string;
}

function PracticeModal({ card, onClose, onRated, token }: PracticeModalProps) {
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const flip = useRef(new Animated.Value(0)).current;

  // Reset every time a new card opens
  useEffect(() => {
    if (card) {
      setRevealed(false);
      setSubmitting(null);
      flip.setValue(0);
    }
  }, [card?.id]);

  const animateFlip = () => {
    Animated.timing(flip, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleTap = () => {
    if (revealed) return;
    setRevealed(true);
    animateFlip();
  };

  const handleRate = async (rating: "easy" | "medium" | "hard") => {
    if (!card || submitting) return;
    setSubmitting(rating);
    try {
      const { card: updated } = await api.practiceCard(token, card.id, rating);
      onRated(updated);
      onClose();
    } catch {
      Alert.alert("Error", "Could not save. Try again.");
      setSubmitting(null);
    }
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
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  if (!card) return null;

  const masteryPct = card.mastery;
  const mColor = masteryColor(masteryPct);

  return (
    <Modal visible={!!card} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.practiceModal}>
        {/* Header */}
        <View style={styles.practiceModalHeader}>
          <View style={styles.practiceModalMeta}>
            <Text style={styles.practiceModalEmoji}>{card.emoji}</Text>
            <View>
              <Text style={styles.practiceModalDomain}>{card.domain}</Text>
              {card.curriculum ? (
                <Text style={styles.practiceModalCurriculum}>{card.curriculum}</Text>
              ) : null}
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.practiceModalClose}>
            <Text style={styles.practiceModalCloseText}>✕</Text>
          </Pressable>
        </View>

        {/* Mastery bar */}
        <View style={styles.practiceMasteryRow}>
          <View style={styles.practiceMasteryTrack}>
            <View style={[styles.practiceMasteryFill, { width: `${masteryPct}%` as any, backgroundColor: mColor }]} />
          </View>
          <Text style={[styles.practiceMasteryPct, { color: mColor }]}>{masteryPct}%</Text>
        </View>

        {/* Flip card */}
        <View style={styles.practiceCardWrap}>
          <Pressable onPress={handleTap} style={styles.practiceFlipFrame} disabled={revealed}>
            {/* Front face — teal */}
            <Animated.View
              style={[
                styles.practiceFace,
                styles.practiceFaceFront,
                { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
              ]}
            >
              <View style={styles.practiceFaceInner}>
                <View style={styles.practiceCorner}>
                  <Text style={styles.practiceCornerText}>FRONT</Text>
                </View>
                <Text style={styles.practiceFrontText}>{card.front}</Text>
                <View style={styles.practiceHintRow}>
                  <Text style={styles.practiceHint}>TAP TO REVEAL →</Text>
                </View>
              </View>
            </Animated.View>

            {/* Back face — white */}
            <Animated.View
              style={[
                styles.practiceFace,
                styles.practiceFaceBack,
                { transform: [{ rotateY: backRotate }], opacity: backOpacity },
              ]}
              pointerEvents={revealed ? "auto" : "none"}
            >
              <View style={styles.practiceFaceInner}>
                <View style={[styles.practiceCorner, styles.practiceCornerLight]}>
                  <Text style={[styles.practiceCornerText, { color: colors.ink }]}>BACK</Text>
                </View>
                <Text style={styles.practiceBackText}>{card.back}</Text>
                {card.example ? (
                  <Text style={styles.practiceBackExample}>"{card.example}"</Text>
                ) : null}
              </View>
            </Animated.View>
          </Pressable>
        </View>

        {/* Rating buttons — only visible after reveal */}
        <View style={[styles.practiceRatingSection, !revealed && { opacity: 0, pointerEvents: "none" } as any]}>
          <Text style={styles.practiceRatingPrompt}>How well did you know it?</Text>
          <View style={styles.practiceRatingRow}>
            {RATING_BUTTONS.map((b) => {
              const loading = submitting === b.r;
              const faded = !!submitting && submitting !== b.r;
              return (
                <Pressable
                  key={b.r}
                  style={({ pressed }) => [
                    styles.practiceRatingBtn,
                    faded && { opacity: 0.35 },
                    pressed && !submitting && styles.practiceRatingBtnPressed,
                  ]}
                  onPress={() => handleRate(b.r)}
                  disabled={!!submitting}
                >
                  <View style={[styles.practiceRatingBtnInner, submitting === b.r && { backgroundColor: b.bg }]}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.practiceRatingEmoji}>{b.emoji}</Text>}
                    <Text style={[styles.practiceRatingLabel, submitting === b.r && { color: "#fff" }]}>
                      {b.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add card modal ───────────────────────────────────────────────────────────

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (body: CreateCardBody) => Promise<void>;
}

function AddCardModal({ visible, onClose, onSave }: AddCardModalProps) {
  const [front, setFront]     = useState("");
  const [back, setBack]       = useState("");
  const [example, setExample] = useState("");
  const [domain, setDomain]   = useState("general");
  const [saving, setSaving]   = useState(false);

  const reset = () => { setFront(""); setBack(""); setExample(""); setDomain("general"); };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert("Required", "Front and back are both required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ front: front.trim(), back: back.trim(), example: example.trim() || undefined, domain: domain as any });
      reset();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save card. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const DOMAINS = ["language", "math", "code", "music", "science", "cooking", "general"];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New card</Text>
          <Pressable onPress={() => { reset(); onClose(); }}>
            <Text style={styles.modalClose}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Front (term / concept) *</Text>
          <TextInput style={styles.fieldInput} value={front} onChangeText={setFront}
            placeholder="e.g. het huis / Array.reduce() / Pythagorean theorem"
            placeholderTextColor={colors.ink4} multiline />

          <Text style={styles.fieldLabel}>Back (definition / translation) *</Text>
          <TextInput style={styles.fieldInput} value={back} onChangeText={setBack}
            placeholder="e.g. the house / a² + b² = c²"
            placeholderTextColor={colors.ink4} multiline />

          <Text style={styles.fieldLabel}>Example (optional)</Text>
          <TextInput style={styles.fieldInput} value={example} onChangeText={setExample}
            placeholder="An example sentence or usage"
            placeholderTextColor={colors.ink4} multiline />

          <Text style={styles.fieldLabel}>Domain</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.domainRow}>
            {DOMAINS.map((d) => (
              <Pressable key={d}
                style={[styles.filterTab, domain === d && styles.filterTabActive]}
                onPress={() => setDomain(d)}>
                <Text style={[styles.filterTabText, domain === d && styles.filterTabTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={[styles.addWordBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.addWordText}>Save card</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Card list item ───────────────────────────────────────────────────────────

interface KnowledgeCardItemProps {
  card: KnowledgeCard;
  onPractice: (card: KnowledgeCard) => void;
  onMasteryToggled: (updated: KnowledgeCard) => void;
  token: string;
}

function KnowledgeCardItem({ card, onPractice, onMasteryToggled, token }: KnowledgeCardItemProps) {
  const diff = difficultyColor[card.difficulty];
  const isLanguage = card.domain === "language";

  const handleToggleMastered = async () => {
    try {
      const { card: updated } = await api.toggleMastered(token, card.id);
      onMasteryToggled(updated);
    } catch {
      Alert.alert("Error", "Could not update. Try again.");
    }
  };

  return (
    <View style={styles.wordCard}>
      <View style={styles.wordCardTop}>
        <Text style={styles.wordEmoji}>{card.emoji}</Text>
        <View style={styles.wordBody}>
          {isLanguage ? (
            <View style={styles.langRow}>
              <Text style={styles.wordTarget}>{card.front}</Text>
              <Text style={styles.langArrow}>→</Text>
              <Text style={styles.wordNative}>{card.back}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.wordTarget}>{card.front}</Text>
              <Text style={styles.cardDefinition}>{card.back}</Text>
            </>
          )}
          {card.example ? (
            <Text style={styles.wordExample}>"{card.example}"</Text>
          ) : null}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: diff.bg, borderColor: diff.fg }]}>
              <Text style={[styles.badgeText, { color: diff.fg }]}>{card.difficulty}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.paperAlt, borderColor: colors.ink4 }]}>
              <Text style={[styles.badgeText, { color: colors.ink3 }]}>{card.domain}</Text>
            </View>
            {card.curriculum ? (
              <Sticker bg={colors.paperAlt} color={colors.ink3} rotate={0}
                style={{ paddingVertical: 2, paddingHorizontal: 7 }}
                textStyle={{ fontSize: 9 }} uppercase={false}>
                {card.curriculum}
              </Sticker>
            ) : null}
          </View>
        </View>
      </View>

      {/* Mastery bar */}
      <View style={styles.masteryRow}>
        <View style={styles.masteryTrack}>
          <View style={[styles.masteryFill, { width: `${card.mastery}%` as any, backgroundColor: masteryColor(card.mastery) }]} />
        </View>
        <Text style={styles.masteryPct}>{card.mastery}%</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.wordActions}>
        <Pressable style={[styles.wordBtn, styles.wordBtnPrimary]} onPress={() => onPractice(card)}>
          <Text style={styles.wordBtnText}>🎯 Practice</Text>
        </Pressable>
        <Pressable style={[styles.wordBtn, styles.wordBtnSecondary]} onPress={handleToggleMastered}>
          <Text style={styles.wordBtnText}>
            {card.mastery >= 80 ? "📌 Review again" : "✓ Mark mastered"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LibraryBank() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [cards, setCards]                       = useState<KnowledgeCard[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [query, setQuery]                       = useState("");
  const [activeFilter, setActiveFilter]         = useState<FilterTab>("all");
  const [activeCurriculum, setActiveCurriculum] = useState<string | null>(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [practicingCard, setPracticingCard]     = useState<KnowledgeCard | null>(null);

  const goBack = () => router.canGoBack() ? router.back() : router.replace("/");
  const goHome = () => router.replace("/");

  const fetchCards = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { cards: fetched } = await api.listCards(token);
      setCards(fetched);
    } catch (e: any) {
      setError(e?.message || "Failed to load cards.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleRefresh = () => { setRefreshing(true); fetchCards(true); };

  const handleAddCard = async (body: CreateCardBody) => {
    const { card } = await api.createCard(token, body);
    setCards((prev) => [card, ...prev]);
  };

  const updateCard = (updated: KnowledgeCard) =>
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  // ── Derived stats ──
  const totalCards    = cards.length;
  const masteredCount = cards.filter((c) => c.mastery >= 80).length;
  const reviewCount   = cards.filter((c) => c.mastery < 80).length;
  const dueCount      = cards.filter(isDue).length;
  const curricula     = uniqueCurricula(cards);

  // ── Filtered list ──
  const filtered = cards.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      c.front.toLowerCase().includes(q) ||
      c.back.toLowerCase().includes(q) ||
      (c.example || "").toLowerCase().includes(q);
    const matchesTab =
      activeFilter === "all" ||
      (activeFilter === "due"      && isDue(c)) ||
      (activeFilter === "mastered" && c.mastery >= 80) ||
      (activeFilter === "review"   && c.mastery < 80);
    const matchesCurriculum =
      !activeCurriculum ||
      c.curriculum_id === activeCurriculum ||
      c.curriculum === activeCurriculum;
    return matchesQuery && matchesTab && matchesCurriculum;
  });

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all",      label: `All (${totalCards})` },
    { id: "due",      label: `Due today (${dueCount})` },
    { id: "review",   label: `To review (${reviewCount})` },
    { id: "mastered", label: `Mastered (${masteredCount})` },
  ];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar title="Library" onBack={goBack} onHome={goHome} />

      <PracticeModal
        card={practicingCard}
        token={token}
        onClose={() => setPracticingCard(null)}
        onRated={(updated) => { updateCard(updated); setPracticingCard(null); }}
      />

      <AddCardModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddCard}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Loading your library…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load cards</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchCards()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
          }
        >
          {/* ── Hero ── */}
          <View style={styles.heroBlock}>
            <Text style={styles.heroEyebrow}>Your knowledge bank</Text>
            <Text style={styles.heroTitle}>Library 🗂️</Text>
            <Text style={styles.heroSubtitle}>
              Concepts, terms, and facts collected from your lessons — search,
              drill, and track mastery over time.
            </Text>
          </View>

          {/* ── Stats strip ── */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{totalCards}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statNum, { color: colors.ok }]}>{masteredCount}</Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statNum, { color: colors.amber }]}>{reviewCount}</Text>
              <Text style={styles.statLabel}>To review</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statNum, { color: colors.amber }]}>{dueCount}</Text>
              <Text style={styles.statLabel}>Due today</Text>
            </View>
          </View>

          {/* ── Search ── */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search cards…"
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

          {/* ── Curriculum picker ── */}
          {curricula.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable
                style={[styles.filterTab, !activeCurriculum && styles.filterTabActive]}
                onPress={() => setActiveCurriculum(null)}>
                <Text style={[styles.filterTabText, !activeCurriculum && styles.filterTabTextActive]}>All curricula</Text>
              </Pressable>
              {curricula.map((cur) => (
                <Pressable key={cur.id}
                  style={[styles.filterTab, activeCurriculum === cur.id && styles.filterTabActive]}
                  onPress={() => setActiveCurriculum(activeCurriculum === cur.id ? null : cur.id)}>
                  <Text style={[styles.filterTabText, activeCurriculum === cur.id && styles.filterTabTextActive]}>
                    {cur.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {/* ── Filter tabs ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {TABS.map((t) => (
              <Pressable key={t.id}
                style={[styles.filterTab, activeFilter === t.id && styles.filterTabActive]}
                onPress={() => setActiveFilter(t.id)}>
                <Text style={[styles.filterTabText, activeFilter === t.id && styles.filterTabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Due today banner ── */}
          {dueCount > 0 && activeFilter !== "mastered" ? (
            <View style={styles.practiceBanner}>
              <View style={styles.practiceBannerTop}>
                <Text style={styles.practiceBannerEmoji}>🧠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.practiceBannerTitle}>
                    {dueCount} card{dueCount !== 1 ? "s" : ""} due today
                  </Text>
                  <Text style={styles.practiceBannerSub}>Keep your streak alive — review before they slip.</Text>
                </View>
              </View>
              <Pressable style={styles.practiceAllBtn} onPress={() => setActiveFilter("due")}>
                <Text style={styles.practiceAllText}>Show due cards →</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Card list ── */}
          <Text style={styles.sectionLabel}>
            {filtered.length} card{filtered.length !== 1 ? "s" : ""}
          </Text>

          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>{totalCards === 0 ? "🌱" : query ? "🔍" : "✓"}</Text>
              <Text style={styles.emptyTitle}>
                {totalCards === 0 ? "No cards yet" : query ? "No matches" : "Nothing here"}
              </Text>
              <Text style={styles.emptyBody}>
                {totalCards === 0
                  ? "Cards are added automatically as you complete flashcard exercises. You can also add them manually below."
                  : query
                  ? `Nothing matched "${query}". Try a different search.`
                  : "No cards match this filter. Try another tab."}
              </Text>
            </View>
          ) : (
            <View style={styles.wordList}>
              {filtered.map((c) => (
                <KnowledgeCardItem
                  key={c.id}
                  card={c}
                  token={token}
                  onPractice={setPracticingCard}
                  onMasteryToggled={updateCard}
                />
              ))}
            </View>
          )}

          {/* ── Add card CTA ── */}
          <Pressable style={styles.addWordBtn} onPress={() => setShowAddModal(true)}>
            <Text style={{ fontSize: 18 }}>＋</Text>
            <Text style={styles.addWordText}>Add a card</Text>
          </Pressable>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
