import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { GemCard, Screen, colors, useShopWidth } from "../ui";

export default function ShopScreen({ navigation, route }) {
  const { currency } = useStore();
  const { card } = useShopWidth();
  const incoming = route.params || {};
  const [filters, setFilters] = useState(incoming);
  const [query, setQuery] = useState(incoming.q || "");
  const [items, setItems] = useState([]);
  const [options, setOptions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setFilters(incoming);
  }, [JSON.stringify(incoming)]);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value !== "" && key !== "title") params.set(key, value);
    }
    api(`/api/products?${params.toString()}`, { currency })
      .then((data) => live && setItems(data.items))
      .catch((err) => live && setError(err.message));
    api("/api/bootstrap", { currency }).then((data) => live && setOptions(data.filters || [])).catch(() => {});
    return () => { live = false; };
  }, [filters, currency]);

  const carats = options.filter((item) => item.filterKey === "carat");
  const quick = [
    ["All pieces", { title: "All pieces" }],
    ["Gemstones", { category: "gemstones", vault: "", limited: "", title: "Gemstones" }],
    ["Jewellery", { category: "jewellery", vault: "", limited: "", title: "Jewellery" }],
    ["Vault", { vault: "1", limited: "", category: "", title: "Vault" }],
    ["Limited", { limited: "1", vault: "", category: "", title: "Limited" }],
  ];

  return (
    <Screen>
      <Text style={styles.kicker}>The counter</Text>
      <Text style={styles.title}>{filters.title || "Shop"}</Text>
      <Text style={styles.sub}>{items.length} {items.length === 1 ? "piece" : "pieces"} · prices in {currency}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        {quick.map(([label, next]) => {
          const on = (filters.title || "Shop") === next.title || (label === "All pieces" && !filters.category && !filters.vault && !filters.limited && !filters.title);
          return (
            <Pressable key={label} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilters({ q: filters.q || "", shop: filters.shop || "", ...next })}>
              <Text style={on ? styles.chipOnText : null}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a gem, a metal, an origin"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCapitalize="none"
          onSubmitEditing={() => setFilters({ ...filters, q: query.trim() })}
        />
        <Pressable style={styles.chip} onPress={() => setFilters({ ...filters, q: query.trim() })}><Text>Search</Text></Pressable>
      </View>
      <View style={styles.row}>
        {[
          ["Featured", "position"],
          ["Price", "price_asc"],
          ["Price, high", "price_desc"],
          ["Newest", "newest"],
        ].map(([label, sort]) => {
          const on = (filters.sort || "position") === sort;
          return (
            <Pressable key={sort} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilters({ ...filters, shop: filters.shop || "", sort })}>
              <Text style={on ? styles.chipOnText : null}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {carats.map((band) => (
          <Pressable key={band.id} style={styles.chip} onPress={() => setFilters({ ...filters, minCarat: band.minValue ?? "", maxCarat: band.maxValue ?? "", title: band.label })}>
            <Text>{band.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <GemCard key={item.id} item={item} width={card} onPress={() => navigation.navigate("Product", { slug: item.slug })} />
        ))}
      </View>
      {!items.length && !error ? <Text style={styles.empty}>Nothing matches. Clear a filter, or ask the desk to list it.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.gold, letterSpacing: 1.4, textTransform: "uppercase", fontSize: 12 },
  title: { fontSize: 34, fontWeight: "600", color: colors.ink, marginTop: 4 },
  sub: { color: colors.muted, marginBottom: 12 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  search: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.paper, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOnText: { color: colors.paper },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  empty: { color: colors.muted, marginTop: 12 },
  error: { color: colors.maroon, marginBottom: 8 },
});
