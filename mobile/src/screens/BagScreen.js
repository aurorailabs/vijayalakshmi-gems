import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

export default function BagScreen({ navigation }) {
  const { ready, user, currency } = useStore();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    api("/api/cart", { currency }).then(setCart).catch((err) => setError(err.message));
  }, [user, currency]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setQty(productId, qty) {
    const next = await api(`/api/cart/${productId}`, { method: "PATCH", body: { qty }, currency });
    setCart(next);
  }

  if (!ready) return <Screen><Text>Opening your bag…</Text></Screen>;

  if (!user) {
    return (
      <Screen>
        <Title kicker="Bag" sub="The bag is kept on your account, so the price is always the portal price.">Sign in to see your bag</Title>
        <Button label="Sign in" onPress={() => navigation.navigate("SignIn")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title kicker="Bag">Pieces to take home</Title>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {(cart?.items || []).map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: item.swatch || colors.maroon }]}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.linePrice}>{item.symbol}{item.line}</Text>
          </View>
          <Pressable onPress={() => setQty(item.id, item.qty - 1)} style={styles.qty}><Text>-</Text></Pressable>
          <Text>{item.qty}</Text>
          <Pressable onPress={() => setQty(item.id, item.qty + 1)} style={styles.qty}><Text>+</Text></Pressable>
        </View>
      ))}
      {cart && !cart.items.length ? <Text style={styles.muted}>The bag is empty.</Text> : null}
      {cart?.items?.length ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <Text style={styles.total}>Pieces {cart.symbol}{cart.subtotal}</Text>
          <Text style={styles.muted}>Delivery, GST, and an offer code are added at checkout.</Text>
          <Button label="Checkout" onPress={() => navigation.navigate("Checkout")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: "hidden" },
  linePrice: { color: colors.maroon, fontWeight: "700", marginTop: 4 },
  name: { fontWeight: "600", color: colors.ink },
  qty: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  total: { fontSize: 20, fontWeight: "600", color: colors.ink },
  muted: { color: colors.muted },
  error: { color: colors.maroon, marginBottom: 8 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginBottom: 8 },
});
