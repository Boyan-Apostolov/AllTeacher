/**
 * Home screen — pure orchestration. Owns the data fetches and the
 * navigation; rendering is delegated to components in `components/home/`
 * and the shared `components/ui/` primitives.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import {
  api,
  BASE_URL,
  type CurriculumListItem,
  type HealthResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CurriculumRow, DiagPill } from "@/components/home";
import { LoadingBlock, MessageBox } from "@/components/ui";
import { Gradient } from "@/components/Gradient";
import { pickGreeting } from "@/lib/curriculum";
import { colors, spacing, type } from "@/lib/theme";

import { homeStyles as styles } from "./index.styles";

export default function Home() {
  const router = useRouter();
  const { user, session, signOut } = useAuth();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [curricula, setCurricula] = useState<CurriculumListItem[] | null>(null);
  const [curriculaError, setCurriculaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e: Error) => !cancelled && setHealthError(e.message));
    if (session?.access_token) {
      api
        .me(session.access_token)
        .then(() => !cancelled && setMeOk(true))
        .catch((e: Error) => {
          if (cancelled) return;
          setMeOk(false);
          setMeError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.access_token) return;
      let cancelled = false;
      const token = session.access_token;
      setCurriculaError(null);
      api
        .listCurricula(token)
        .then((res) => !cancelled && setCurricula(res.curricula))
        .catch((e: Error) => !cancelled && setCurriculaError(e.message));
      return () => {
        cancelled = true;
      };
    }, [session?.access_token]),
  );

  const removeCurriculum = (c: CurriculumListItem) => {
    if (!session?.access_token) return;
    const token = session.access_token;
    const label = c.goal || c.topic || "this curriculum";
    Alert.alert(
      "Remove curriculum?",
      `“${label}” and all its data will be deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setCurricula((prev) =>
              prev ? prev.filter((x) => x.id !== c.id) : prev,
            );
            try {
              await api.deleteCurriculum(token, c.id);
            } catch (e) {
              setCurriculaError((e as Error).message);
              try {
                const res = await api.listCurricula(token);
                setCurricula(res.curricula);
              } catch {
                /* ignore */
              }
            }
          },
        },
      ],
    );
  };

  const greeting = pickGreeting(user?.email ?? "x");
  const firstName = user?.email?.split("@")[0] ?? "";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Gradient
          from={colors.brand}
          via={colors.accent}
          to={colors.brandDeep}
          angle={140}
          style={styles.hero}
        >
          <Text style={styles.heroEyebrow}>AllTeacher</Text>
          <Text style={styles.heroTitle}>
            {greeting}, {firstName} 👋
          </Text>
          <Text style={styles.heroSubtitle}>
            Pick up where you left off, or start something new.
          </Text>
          <View style={styles.heroCtaRow}>
            <Pressable
              style={styles.heroCta}
              onPress={() => router.push("/curriculum/new")}
            >
              <Text style={styles.heroCtaText}>+ Start something new</Text>
            </Pressable>
            <Pressable
              style={styles.heroCtaGhost}
              onPress={() => router.push("/progress")}
            >
              <Text style={styles.heroCtaGhostText}>📈 Progress</Text>
            </Pressable>
          </View>
        </Gradient>

        {/* Curricula */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Your curricula</Text>

          {curriculaError ? (
            <MessageBox variant="error" message={curriculaError} />
          ) : curricula === null ? (
            <View style={styles.card}>
              <LoadingBlock light={false} />
            </View>
          ) : curricula.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={type.h3}>No curricula yet</Text>
              <Text style={type.bodyMuted}>
                Tell AllTeacher what you want to learn — anything from
                conversational Italian to drumming or React. The Assessor
                will tailor a plan to your level and the time you've got.
              </Text>
              <Pressable
                style={styles.emptyCta}
                onPress={() => router.push("/curriculum/new")}
              >
                <Text style={styles.emptyCtaText}>Choose a goal →</Text>
              </Pressable>
            </View>
          ) : (
            curricula.map((c) => (
              <CurriculumRow
                key={c.id}
                item={c}
                onOpen={() => router.push(`/curriculum/${c.id}`)}
                onRemove={() => removeCurriculum(c)}
              />
            ))
          )}
        </View>

        {/* Diagnostics */}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Text style={styles.sectionLabel}>Diagnostics</Text>
          <View style={styles.diagRow}>
            <DiagPill ok={!healthError && !!health} label="API" />
            <DiagPill ok={meOk === true} label="JWT" />
            <DiagPill ok={!!health?.configured.openai} label="OpenAI" />
            <DiagPill ok={!!health?.configured.supabase} label="Supabase" />
          </View>
          <Text style={styles.diagDetail}>{BASE_URL}</Text>
          {healthError ? (
            <Text style={styles.diagError}>{healthError}</Text>
          ) : null}
          {meError ? <Text style={styles.diagError}>{meError}</Text> : null}
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
