import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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

export function useShopWidth() {
  const { width } = useWindowDimensions();
  const page = Math.min(width, 1120);
  const pad = page > 760 ? 28 : 16;
  const inner = page - pad * 2;
  const columns = inner > 900 ? 4 : inner > 640 ? 3 : 2;
  const card = Math.floor((inner - (columns - 1) * 14) / columns);
  return { wide: width > 760, columns, card, inner };
}

export function Screen({ children, safe = true }) {
  const insets = useSafeAreaInsets();
  const { wide } = useShopWidth();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (safe ? insets.top : 0) + (wide ? 28 : 16),
          paddingHorizontal: wide ? 28 : 16,
          width: "100%",
          maxWidth: 1120,
          alignSelf: "center",
        },
      ]}
    >
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

export function Button({ label, onPress, ghost, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, ghost && styles.ghost, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, ghost && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function GemCard({ item, onPress, width = 168 }) {
  const mark = item.vault ? "By appointment" : item.limited ? "Limited" : item.stock === 1 ? "One left" : item.carat ? `${item.carat} ct` : "";
  return (
    <Pressable onPress={onPress} style={[styles.card, { width }]} accessibilityRole="button" accessibilityLabel={`View ${item.name}`}>
      <View style={[styles.gem, { backgroundColor: item.swatch || colors.maroon, height: Math.round(width * 1.18) }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" /> : null}
        {mark ? <View style={styles.badge}><Text style={styles.gemMark}>{mark}</Text></View> : null}
      </View>
      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      {item.shopName ? <Text style={styles.cardShop} numberOfLines={1}>{item.shopName}</Text> : null}
      <Text style={styles.cardMeta} numberOfLines={1}>{[item.origin, item.certification].filter(Boolean).join(" · ") || item.metal}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{money(item)}</Text>
        {item.compareAt ? <Text style={styles.compare}>{item.symbol}{Math.round(item.compareAt).toLocaleString("en-IN")}</Text> : null}
      </View>
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
  content: { padding: 18, paddingBottom: 110 },
  kicker: { color: colors.gold, letterSpacing: 1.6, textTransform: "uppercase", fontSize: 12, marginBottom: 4 },
  title: { fontSize: 32, color: colors.ink, fontWeight: "600" },
  sub: { color: colors.muted, marginTop: 6, fontSize: 15 },
  button: { backgroundColor: colors.maroon, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  disabled: { opacity: 0.55 },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: "#fffaf3", fontWeight: "600" },
  ghostText: { color: colors.ink },
  card: { marginBottom: 6 },
  gem: { borderRadius: 18, overflow: "hidden", justifyContent: "flex-end" },
  photo: { ...StyleSheet.absoluteFillObject },
  badge: { position: "absolute", left: 8, top: 8, backgroundColor: "rgba(24, 14, 10, 0.72)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  gemMark: { color: "#fffaf3", fontSize: 11, fontWeight: "700" },
  cardName: { marginTop: 10, color: colors.ink, fontSize: 16, fontWeight: "600" },
  cardShop: { color: colors.gold, fontSize: 12, fontWeight: "700", marginTop: 2 },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 },
  price: { color: colors.maroon, fontWeight: "700", fontSize: 16 },
  compare: { color: colors.muted, textDecorationLine: "line-through", fontSize: 13 },
});
