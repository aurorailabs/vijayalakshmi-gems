import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function phoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export default function AuthScreen({ navigation, route }) {
  const { signIn } = useStore();
  const [mode, setMode] = useState(route.params?.mode === "register" ? "register" : "login");
  const [form, setForm] = useState({ name: "", identifier: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: mode === "login" ? "Sign in" : "Create account" });
  }, [mode, navigation]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function problem() {
    if (mode === "login") {
      const identifier = form.identifier.trim();
      if (!identifier) return "Enter your email or phone number.";
      if (identifier.includes("@") && !EMAIL.test(identifier)) return "Enter a valid email.";
      if (!identifier.includes("@") && phoneDigits(identifier).length < 10) return "Enter a valid phone number.";
      return form.password ? "" : "Enter your password.";
    }
    if (form.name.trim().length < 2) return "Enter your name.";
    if (!EMAIL.test(form.email.trim())) return "Enter a valid email.";
    if (phoneDigits(form.phone).length < 10) return "Enter a valid phone number.";
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return "Use at least 8 characters, with letters and a number.";
    }
    return "";
  }

  async function submit() {
    const message = problem();
    setError(message);
    if (message || busy) return;
    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { identifier: form.identifier.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password };
      const result = await api(path, { method: "POST", body });
      await signIn(result.token, result.user);
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("Main", { screen: "Account" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen safe={false}>
      <Title
        kicker="Account"
        sub={mode === "login" ? "Orders, the bag, and the saved list live on your account." : "The same account works on this phone and the next."}
      >
        {mode === "login" ? "Sign in" : "Create an account"}
      </Title>
      {mode === "register" ? (
        <Field label="Name" value={form.name} onChangeText={(value) => set("name", value)} autoComplete="name" textContentType="name" />
      ) : null}
      {mode === "login" ? (
        <Field
          label="Email or phone"
          value={form.identifier}
          onChangeText={(value) => set("identifier", value)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
        />
      ) : (
        <Field
          label="Email"
          value={form.email}
          onChangeText={(value) => set("email", value)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
      )}
      <Field
        label="Password"
        value={form.password}
        onChangeText={(value) => set("password", value)}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        textContentType={mode === "login" ? "password" : "newPassword"}
      />
      {mode === "register" ? (
        <Field label="Phone" value={form.phone} onChangeText={(value) => set("phone", value)} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} onPress={submit} disabled={busy} />
      <Pressable
        onPress={() => {
          setError("");
          setMode(mode === "login" ? "register" : "login");
        }}
        style={styles.switch}
        accessibilityRole="button"
      >
        <Text style={styles.link}>{mode === "login" ? "New here? Create an account" : "Already registered? Sign in"}</Text>
      </Pressable>
      <Text style={styles.hint}>Sample shopper: meera@vijayalakshmi.local or 8000001002 / Demo@123</Text>
    </Screen>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 10 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12 },
  error: { color: colors.maroon, marginBottom: 10 },
  switch: { marginTop: 16 },
  link: { color: colors.maroon },
  hint: { color: colors.muted, marginTop: 18 },
});
