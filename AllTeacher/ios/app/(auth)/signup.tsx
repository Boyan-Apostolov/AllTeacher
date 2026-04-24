import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      // If Supabase email confirmation is OFF, session is set and root
      // layout redirects. If it's ON, user must confirm via email first.
      setInfo("Account created. If email confirmation is enabled, check your inbox.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start learning anything, in any language</Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 chars)"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            disabled={submitting || !email || password.length < 6}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </Pressable>

          <Link href="/(auth)/login" style={styles.footerLink}>
            <Text style={styles.footer}>
              Have an account? <Text style={styles.footerAccent}>Sign in</Text>
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#666", marginBottom: 16 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: "#c0392b", fontSize: 14 },
  info: { color: "#2d6a4f", fontSize: 14 },
  button: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footerLink: { marginTop: 16, alignSelf: "center" },
  footer: { fontSize: 14, color: "#666" },
  footerAccent: { color: "#111", fontWeight: "600" },
});
