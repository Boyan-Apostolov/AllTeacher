/**
 * Daily reminder settings — simple on/off toggle.
 * Fires at 8:00 PM every day with the user's current streak in the body.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import {
  cancelReminder,
  isReminderEnabled,
  requestNotificationPermission,
  scheduleReminder,
} from "@/lib/notifications";
import { Toolbar } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export default function ReminderScreen() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isReminderEnabled().then((v) => {
      setEnabled(v);
      setLoading(false);
    });
  }, []);

  const toggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Enable notifications for AllTeacher in iOS Settings to use this feature.",
        );
        return;
      }
      await scheduleReminder(0);
      setEnabled(true);
    } else {
      await cancelReminder();
      setEnabled(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar
        title="Daily reminder"
        onBack={() => router.canGoBack() ? router.back() : router.replace("/")}
        onHome={() => router.replace("/")}
      />

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Remind me daily</Text>
              <Text style={styles.sub}>
                {enabled
                  ? "You'll get a nudge at 8:00 PM every day."
                  : "Off — no notifications will be sent."}
              </Text>
            </View>
            {!loading ? (
              <Switch
                value={enabled}
                onValueChange={toggle}
                trackColor={{ true: colors.brand, false: colors.ink4 }}
                thumbColor="#fff"
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.hint}>
          Your streak count is included so you know exactly what's at stake.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontSize: 16, fontWeight: "900", color: colors.ink },
  sub: { fontSize: 13, color: colors.ink3, marginTop: 2, lineHeight: 18 },
  hint: { fontSize: 12, color: colors.ink4, lineHeight: 18, textAlign: "center" },
});
