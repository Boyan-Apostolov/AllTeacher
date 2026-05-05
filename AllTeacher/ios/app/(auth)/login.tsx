/**
 * Login screen — neo-brutalist redesign.
 * Mascot peeking, "Welcome back." heading, brutalist fields, MegaPill CTA.
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { Field, MessageBox, PrimaryCta } from "@/components/ui";
import { Mascot } from "@/components/ui/Mascot";
import { Sticker } from "@/components/ui/Sticker";
import { colors, radii, spacing } from "@/lib/theme";

import { authStyles as styles } from "./auth.styles";

export default function Login() {
  const { signIn, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    import("expo-apple-authentication").then((mod) => {
      mod.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    });
  }, []);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onApple = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e?.code !== "ERR_CANCELED") {
        setError(e?.message || e?.toString() || "Apple Sign In failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!email && !!password && !submitting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={localStyles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Mascot + "hey 👋" sticker */}
            <View style={[styles.mascotRow, { marginTop: 20 }]}>
              <Mascot size={70} mood="happy" color={colors.brand} />
              <View style={{ marginBottom: 14 }}>
                <Sticker bg="#FFE066" color={colors.ink} rotate={-6} uppercase={false}>
                  hey 👋
                </Sticker>
              </View>
            </View>

            {/* Heading */}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.heroTitle}>
                Welcome{"\n"}
                <Text style={styles.heroTitleAccent}>back.</Text>
              </Text>
              <Text style={styles.heroSub}>
                Pick up where you left off.
              </Text>
            </View>

            {/* Fields */}
            <View style={styles.fields}>
              <Field
                label="Email"
                placeholder="maya@hey.com"
                value={email}
                onChangeText={setEmail}
                focused={focused === "email"}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Field
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                focused={focused === "password"}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
            </View>

            {error ? (
              <View style={styles.errorWrap}>
                <MessageBox variant="error" message={error} />
              </View>
            ) : null}

            <View style={styles.ctaWrap}>
              <PrimaryCta
                label="Log in →"
                onPress={onSubmit}
                loading={submitting}
                disabled={!canSubmit}
                bg={colors.brand}
              />
            </View>

            {appleAvailable ? (
              <AppleDividerAndButton onPress={onApple} disabled={submitting} />
            ) : null}

            <Link href="/(auth)/signup" asChild>
              <Pressable style={styles.footerLink}>
                <Text style={styles.footer}>
                  New here?{" "}
                  <Text style={styles.footerAccent}>Make an account</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppleDividerAndButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const [AppleAuthentication, setMod] = useState<any>(null);

  useEffect(() => {
    import("expo-apple-authentication").then(setMod).catch(() => {});
  }, []);

  if (!AppleAuthentication) return null;

  return (
    <View style={appleStyles.wrap}>
      <View style={appleStyles.dividerRow}>
        <View style={appleStyles.line} />
        <Text style={appleStyles.orText}>or</Text>
        <View style={appleStyles.line} />
      </View>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radii.lg}
        style={appleStyles.button}
        onPress={onPress}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  scroll: { flexGrow: 1 },
});

const appleStyles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  line: { flex: 1, height: 1.5, backgroundColor: colors.ink4 },
  orText: { fontSize: 13, color: colors.ink3, fontWeight: "600" },
  button: { height: 50, width: "100%" },
});
