/**
 * Persistent bottom tab bar — rendered at the root layout level so it
 * appears across Home, Progress, Vocab, and Plans. Hidden automatically
 * on session/exercise/curriculum/auth screens.
 */
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bottomTabStyles as styles } from "./BottomTabBar.styles";

// ── Height constant exported so scroll views can add matching padding ─────────
export const TAB_BAR_CONTENT_HEIGHT = 60; // px, excluding safe-area bottom

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { label: "Home",     emoji: "🏠", route: "/" },
  { label: "Progress", emoji: "📈", route: "/progress" },
  { label: "Vocab",    emoji: "📖", route: "/vocabulary" },
  { label: "Plans",    emoji: "✦",  route: "/subscription" },
] as const;

export function BottomTabBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
        const active = pathname === tab.route;
        return (
          <Pressable
            key={tab.route}
            style={styles.tab}
            onPress={() => router.navigate(tab.route)}
          >
            {active ? <View style={styles.activeBar} /> : null}
            <Text style={styles.emoji}>{tab.emoji}</Text>
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
