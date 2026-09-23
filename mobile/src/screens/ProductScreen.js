import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { api, money } from "../api";
import { useStore } from "../store";
import { Button, Screen, colors } from "../ui";

export default function ProductScreen({ navigation, route }) {
  const { currency, user } = useStore();
  const [product, setProduct] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api(`/api/products/${route.params.slug}`, { currency })
      .then((data) => live && setProduct(data.product))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [route.params.slug, currency]);

  async function addBag() {
    setMessage("");
    if (!user) {
      navigation.navigate("Main", { screen: "Account" });
      return;
    }
    try {
      await api("/api/cart", { method: "POST", body: { productId: product.id, qty: 1 }, currency });
      setMessage("Added to your bag.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function wish() {
    if (!user) {
      navigation.navigate("Main", { screen: "Account" });
      return;
    }
    try {
      await api("/api/wishlist", { method: "POST", body: { productId: product.id } });
      setMessage("Saved to your list.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !product) return <Screen><Text style={{ color: colors.maroon }}>{error}</Text></Screen>;
  if (!product) return <Screen><Text>Bringing the piece…</Text></Screen>;

  const facts = [
    ["Weight", product.carat ? `${product.carat} ct` : ""],
    ["Shape", product.shape],
    ["Origin", product.origin],
    ["Treatment", product.treatment],
    ["Paper", product.certification],
    ["Metal", product.metal],
    ["In stock", product.callForPrice ? "" : String(product.stock)],
  ].filter(([, value]) => value);

  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: product.swatch || colors.maroon }]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} /> : null}
      </View>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{money(product)}</Text>
      <Text style={styles.summary}>{product.summary}</Text>
      <Text style={styles.body}>{product.description}</Text>
      {product.benefit ? <Text style={styles.benefit}>{product.benefit}</Text> : null}
      {facts.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text>{value}</Text>
        </View>
      ))}
      {error ? <Text style={{ color: colors.maroon }}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={{ gap: 8, marginTop: 16 }}>
        {product.callForPrice ? (
          <Button label="Ask the desk for the price" onPress={() => navigation.navigate("Enquire", { type: "call_for_price", productId: product.id, productName: product.name })} />
        ) : (
          <Button label={user ? "Add to bag" : "Sign in to add"} onPress={addBag} />
        )}
        <Button ghost label={user ? "Save" : "Sign in to save"} onPress={wish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, borderRadius: 20, marginBottom: 16, overflow: "hidden" },
  name: { fontSize: 30, color: colors.ink, fontWeight: "600" },
  price: { color: colors.maroon, fontSize: 20, marginVertical: 6, fontWeight: "600" },
  summary: { color: colors.ink, fontSize: 16 },
  body: { color: colors.muted, marginTop: 8 },
  benefit: { marginTop: 10, color: colors.ink },
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  factLabel: { color: colors.muted },
  message: { marginTop: 10, color: "#1f6b3a" },
});
