import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, formProblem, money } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

export default function RecommendScreen({ navigation }) {
  const { currency, user } = useStore();
  const [purposes, setPurposes] = useState([]);
  const [form, setForm] = useState({
    birthDate: "1990-08-20",
    birthTime: "06:30",
    birthPlace: "Bengaluru",
    weightKg: "60",
    purpose: "wealth",
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    api("/api/bootstrap", { currency }).then((data) => setPurposes(data.purposes || [])).catch((err) => setError(err.message));
  }, [currency]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    setProblem(null);
    try {
      const data = await api("/api/recommendations", {
        method: "POST",
        currency,
        body: { ...form, weightKg: form.weightKg ? Number(form.weightKg) : null, email: user?.email || "" },
      });
      setResult(data);
    } catch (err) {
      setProblem(formProblem(err));
    }
  }

  return (
    <Screen>
      <Title kicker="Advice" sub="The stone comes from the rashi windows and purpose map saved in the portal.">Which stone to wear</Title>
      <Field name="birthDate" problem={problem} label="Birth date (YYYY-MM-DD)" value={form.birthDate} onChangeText={(value) => set("birthDate", value)} />
      <Field label="Birth time" value={form.birthTime} onChangeText={(value) => set("birthTime", value)} />
      <Field label="Place of birth" value={form.birthPlace} onChangeText={(value) => set("birthPlace", value)} />
      <Field label="Body weight, kg" value={form.weightKg} onChangeText={(value) => set("weightKg", value)} keyboardType="decimal-pad" />
      <Text style={styles.label}>Purpose</Text>
      {problem?.field === "purpose" ? <Text style={styles.error}>{problem.message}</Text> : null}
      <View style={styles.row}>
        {purposes.map((purpose) => (
          <Pressable key={purpose.slug} onPress={() => set("purpose", purpose.slug)} style={[styles.chip, form.purpose === purpose.slug && styles.chipOn]}>
            <Text style={form.purpose === purpose.slug ? styles.chipOnText : null}>{purpose.name}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Your name" value={form.name} onChangeText={(value) => set("name", value)} />
      <Field label="Phone" value={form.phone} onChangeText={(value) => set("phone", value)} />
      {error || (problem?.message && !problem.field) ? <Text style={styles.error}>{error || problem.message}</Text> : null}
      <Button label="Show the guide" onPress={submit} />
      {result ? (
        <View style={styles.result}>
          {result.rashi ? <Text style={styles.resultTitle}>{result.rashi.name} · {result.rashi.englishName}</Text> : null}
          {result.lifeStone ? <Text>Life stone: {result.lifeStone.name} ({result.lifeStone.planet})</Text> : null}
          {result.purposeStone ? <Text>For this purpose: {result.purposeStone.name} — {result.purposeStone.reason}</Text> : null}
          {result.suggestedCarat ? <Text>Suggested weight: {result.suggestedCarat} carat. {result.weightNote}</Text> : null}
          <Text style={styles.note}>{result.disclaimer}</Text>
          {result.products.map((item) => (
            <Pressable key={item.id} style={styles.pick} onPress={() => navigation.navigate("Product", { slug: item.slug })}>
              <Text style={styles.pickName}>{item.name}</Text>
              <Text>{money(item)}</Text>
            </Pressable>
          ))}
          <Button label="Ask a counsellor to call" onPress={() => navigation.navigate("Enquire", { type: "astrologer", message: `Advice request ${result.id}` })} />
        </View>
      ) : null}
    </Screen>
  );
}

function Field({ label, name, problem, ...props }) {
  const message = problem?.field === name ? problem.message : "";
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} />
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, marginBottom: 4 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOnText: { color: colors.paper },
  error: { color: colors.maroon, marginBottom: 8 },
  result: { marginTop: 18, gap: 8, backgroundColor: colors.paper, padding: 14, borderRadius: 16 },
  resultTitle: { fontSize: 22, fontWeight: "600", color: colors.ink },
  note: { color: colors.muted },
  pick: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  pickName: { fontWeight: "600", color: colors.ink },
});
