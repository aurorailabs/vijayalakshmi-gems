import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { GemCard, Screen, Title, colors } from "../ui";

export default function ShopScreen({ navigation, route }) {
  const { currency } = useStore();
  const incoming = route.params || {};
  const [filters, setFilters] = useState(incoming);
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

  function apply(next) {
    setFilters({ ...filters, ...next });
  }

  const carats = options.filter((item) => item.filterKey === "carat");
  const quick = [
    ["All", {}],
    ["Vault", { vault: "1", limited: "", category: "" }],
    ["Limited", { limited: "1", vault: "", category: "" }],
    ["Jewellery", { category: "jewellery", vault: "", limited: "" }],
  ];

  return (
    <Screen>
      <Title kicker="The list" sub="Prices follow the currency chosen on the home screen.">{filters.title || "Shop"}</Title>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        {quick.map(([label, next]) => (
          <Pressable key={label} style={styles.chip} onPress={() => setFilters({ q: filters.q || "", ...next, title: label === "All" ? "Shop" : label })}>
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {carats.map((band) => (
          <Pressable key={band.id} style={styles.chip} onPress={() => apply({ minCarat: band.minValue ?? "", maxCarat: band.maxValue ?? "", title: band.label })}>
            <Text>{band.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <GemCard key={item.id} item={item} onPress={() => navigation.navigate("Product", { slug: item.slug })} />
        ))}
      </View>
      {!items.length && !error ? <Text style={styles.empty}>Nothing in this cut of the list. The desk can add it from the portal.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.paper, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  empty: { color: colors.muted, marginTop: 12 },
  error: { color: colors.maroon, marginBottom: 8 },
});
