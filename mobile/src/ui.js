import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { money } from "./api";

export const colors = {
  ivory: "#f6f1e8",
  paper: "#fffaf3",
  ink: "#241910",
  muted: "#6d5c4e",
  maroon: "#7c2432",
  gold: "#8a5a28",
  line: "#eadfce",
};

export function Screen({ children, safe = true }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: (safe ? insets.top : 0) + 16 }]}>
      {children}
    </ScrollView>
  );
}

export function Title({ kicker, children, sub }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, ghost }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, ghost && styles.ghost]}>
      <Text style={[styles.buttonText, ghost && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function GemCard({ item, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.gem, { backgroundColor: item.swatch || colors.maroon }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} /> : null}
        <Text style={styles.gemMark}>{item.vault ? "Vault" : item.limited ? "Limited" : item.carat ? `${item.carat} ct` : item.kind}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.origin || item.metal || item.summary}</Text>
      <Text style={styles.price}>{money(item)}{item.compareAt ? `  ${item.symbol}${Math.round(item.compareAt)}` : ""}</Text>
    </Pressable>
  );
}

export function openTarget(navigation, target) {
  if (!target) return;
  const [kind, value] = String(target).split(":");
  if (kind === "shop") {
    const params = {};
    if (value === "vault") params.vault = "1";
    else if (value === "limited") params.limited = "1";
    else if (value) params.category = value;
    navigation.navigate("Shop", params);
  } else if (kind === "enquire") {
    navigation.navigate("Enquire", { type: value || "expert" });
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 18, paddingBottom: 40 },
  kicker: { color: colors.gold, letterSpacing: 1.6, textTransform: "uppercase", fontSize: 12, marginBottom: 4 },
  title: { fontSize: 32, color: colors.ink, fontWeight: "600" },
  sub: { color: colors.muted, marginTop: 6, fontSize: 15 },
  button: { backgroundColor: colors.maroon, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: "#fffaf3", fontWeight: "600" },
  ghostText: { color: colors.ink },
  card: { width: 168, marginRight: 12 },
  gem: { height: 150, borderRadius: 16, justifyContent: "flex-end", padding: 10, overflow: "hidden" },
  photo: { ...StyleSheet.absoluteFillObject },
  gemMark: { color: "#fffaf3", fontSize: 12, fontWeight: "600" },
  cardName: { marginTop: 8, color: colors.ink, fontSize: 15, fontWeight: "600" },
  cardMeta: { color: colors.muted, fontSize: 12 },
  price: { marginTop: 4, color: colors.maroon, fontWeight: "600" },
});
