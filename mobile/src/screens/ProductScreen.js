import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { api, money } from "../api";
import { useStore } from "../store";
import { Button, GemCard, Screen, colors, useShopWidth } from "../ui";

export default function ProductScreen({ navigation, route }) {
  const { currency, user } = useStore();
  const { width } = useWindowDimensions();
  const { card } = useShopWidth();
  const wide = width > 860;
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [review, setReview] = useState({ rating: "5", title: "", body: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setProduct(null);
    api(`/api/products/${route.params.slug}`, { currency })
      .then((data) => {
        if (!live) return;
        setProduct(data.product);
        setRelated(data.related || []);
        setReviews(data.reviews || []);
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [route.params.slug, currency]);

  async function addBag() {
    setMessage("");
    setError("");
    if (!user) {
      navigation.navigate("SignIn");
      return;
    }
    try {
      await api("/api/cart", { method: "POST", body: { productId: product.id, qty: 1 }, currency });
      setMessage("In your bag.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendReview() {
    setError("");
    try {
      await api(`/api/products/${route.params.slug}/reviews`, {
        method: "POST",
        body: { ...review, rating: Number(review.rating) },
      });
      const data = await api(`/api/products/${route.params.slug}`, { currency });
      setReviews(data.reviews || []);
      setReview({ rating: "5", title: "", body: "" });
      setMessage("Your review is on the piece.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function wish() {
    setError("");
    if (!user) {
      navigation.navigate("SignIn");
      return;
    }
    try {
      await api("/api/wishlist", { method: "POST", body: { productId: product.id } });
      setMessage("Saved. You can come back to it.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !product) return <Screen safe={false}><Text style={{ color: colors.maroon }}>{error}</Text></Screen>;
  if (!product) return <Screen safe={false}><Text>Bringing the piece…</Text></Screen>;

  const facts = [
    ["Weight", product.carat ? `${product.carat} ct` : ""],
    ["Shape", product.shape],
    ["Origin", product.origin],
    ["Treatment", product.treatment],
    ["Certificate", product.certification],
    ["Metal", product.metal],
  ].filter(([, value]) => value);

  return (
    <Screen safe={false}>
      <View style={wide ? styles.split : null}>
        <View style={[styles.hero, { backgroundColor: product.swatch || colors.maroon }, wide && styles.heroWide]}>
          {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        </View>
        <View style={wide ? styles.buy : null}>
          <Text style={styles.kicker}>{product.vault ? "Vault" : product.limited ? "Limited this week" : product.kind === "jewellery" ? "Jewellery" : "Loose stone"}</Text>
          <Text style={styles.name}>{product.name}</Text>
          {product.shopName ? (
            <Pressable onPress={() => navigation.navigate("Shop", { shop: product.shopSlug, title: product.shopName })}>
              <Text style={styles.shop}>From {product.shopName}{product.shopCity ? ` · ${product.shopCity}` : ""}</Text>
            </Pressable>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(product)}</Text>
            {product.compareAt ? <Text style={styles.compare}>{product.symbol}{Math.round(product.compareAt).toLocaleString("en-IN")}</Text> : null}
          </View>
          {!product.callForPrice && product.stock === 1 ? <Text style={styles.urgent}>Only one left at this price.</Text> : null}
          {!product.callForPrice && product.stock > 1 ? <Text style={styles.stock}>{product.stock} in the atelier</Text> : null}
          <Text style={styles.summary}>{product.summary}</Text>
          {product.benefit ? <Text style={styles.benefit}>{product.benefit}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {product.callForPrice ? (
              <Button label="Ask the desk for the price" onPress={() => navigation.navigate("Enquire", { type: "call_for_price", productId: product.id, productName: product.name })} />
            ) : (
              <Button label={user ? "Add to bag" : "Sign in and add to bag"} onPress={addBag} />
            )}
            <View style={styles.secondary}>
              <Button ghost label={user ? "Save for later" : "Sign in to save"} onPress={wish} />
              {message === "In your bag." ? <Button ghost label="Go to bag" onPress={() => navigation.navigate("Main", { screen: "Bag" })} /> : null}
            </View>
          </View>
          <Text style={styles.reassure}>Lab note travels with the stone. Loose stones can return within ten days if they are still unset.</Text>
        </View>
      </View>

      <Text style={styles.body}>{product.description}</Text>
      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text style={styles.factValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.relatedTitle}>Reviews</Text>
      {reviews.map((item) => (
        <View key={item.id} style={styles.review}>
          <Text style={styles.factValue}>{item.author} · {item.rating}/5{item.verified ? " · Bought here" : ""}</Text>
          {item.title ? <Text style={styles.nameSmall}>{item.title}</Text> : null}
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
      {!reviews.length ? <Text style={styles.stock}>No reviews yet.</Text> : null}
      {user ? (
        <View style={{ marginTop: 12 }}>
          <TextInput value={review.title} onChangeText={(value) => setReview({ ...review, title: value })} placeholder="Title" placeholderTextColor={colors.muted} style={styles.reviewInput} />
          <TextInput value={review.body} onChangeText={(value) => setReview({ ...review, body: value })} placeholder="What should the next buyer know?" placeholderTextColor={colors.muted} style={styles.reviewInput} multiline />
          <View style={styles.secondary}>
            {["1", "2", "3", "4", "5"].map((score) => (
              <Button key={score} ghost={review.rating !== score} label={score} onPress={() => setReview({ ...review, rating: score })} />
            ))}
          </View>
          <Button label="Publish review" onPress={sendReview} />
        </View>
      ) : (
        <Button ghost label="Sign in to review" onPress={() => navigation.navigate("SignIn")} />
      )}

      {related.length ? (
        <>
          <Text style={styles.relatedTitle}>Worn with this</Text>
          <View style={styles.grid}>
            {related.map((item) => (
              <GemCard key={item.id} item={item} width={card} onPress={() => navigation.push("Product", { slug: item.slug })} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  hero: { height: 380, borderRadius: 24, overflow: "hidden", marginBottom: 16 },
  heroWide: { width: "48%", height: 520, marginBottom: 0 },
  buy: { flex: 1 },
  kicker: { color: colors.gold, letterSpacing: 1.3, textTransform: "uppercase", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 34, color: colors.ink, fontWeight: "600", marginTop: 4 },
  shop: { color: colors.gold, fontWeight: "700", marginTop: 6 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 8 },
  price: { color: colors.maroon, fontSize: 28, fontWeight: "700" },
  compare: { color: colors.muted, textDecorationLine: "line-through", fontSize: 16 },
  urgent: { color: colors.maroon, marginTop: 6, fontWeight: "700" },
  stock: { color: colors.muted, marginTop: 6 },
  summary: { color: colors.ink, fontSize: 17, marginTop: 10 },
  benefit: { marginTop: 8, color: colors.ink, lineHeight: 22 },
  body: { color: colors.muted, marginTop: 18, fontSize: 16, lineHeight: 24 },
  actions: { marginTop: 16, gap: 8 },
  secondary: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  reassure: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  facts: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  factLabel: { color: colors.muted },
  factValue: { color: colors.ink, fontWeight: "600" },
  relatedTitle: { marginTop: 28, marginBottom: 12, fontSize: 24, fontWeight: "600", color: colors.ink },
  review: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  reviewInput: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginBottom: 8 },
  nameSmall: { fontWeight: "600", color: colors.ink, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  error: { color: colors.maroon, marginTop: 8 },
  message: { marginTop: 8, color: "#1f6b3a", fontWeight: "600" },
});
