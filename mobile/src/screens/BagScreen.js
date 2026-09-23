import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

export default function BagScreen({ navigation }) {
  const { user, currency } = useStore();
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

  if (!user) {
    return (
      <Screen>
        <Title kicker="Bag" sub="The bag is kept on your account, so the price is always the portal price.">Sign in to see your bag</Title>
        <Button label="Go to account" onPress={() => navigation.navigate("Account")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title kicker="Bag">Pieces to take home</Title>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {(cart?.items || []).map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>{item.symbol}{item.line}</Text>
          </View>
          <Pressable onPress={() => setQty(item.id, item.qty - 1)} style={styles.qty}><Text>-</Text></Pressable>
          <Text>{item.qty}</Text>
          <Pressable onPress={() => setQty(item.id, item.qty + 1)} style={styles.qty}><Text>+</Text></Pressable>
        </View>
      ))}
      {cart && !cart.items.length ? <Text style={styles.muted}>The bag is empty.</Text> : null}
      {cart?.items?.length ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <Text style={styles.total}>Total {cart.symbol}{cart.subtotal}</Text>
          <Button label="Checkout" onPress={() => navigation.navigate("Checkout")} />
        </View>
      ) : null}
    </Screen>
  );
}

export function CheckoutScreen({ navigation }) {
  const { user, currency } = useStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    city: "",
    country: "India",
    note: "",
  });
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function place() {
    setError("");
    try {
      const data = await api("/api/checkout", { method: "POST", currency, body: { shipping: form, note: form.note } });
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    }
  }

  if (order) {
    return (
      <Screen>
        <Title kicker="Placed">Order #{order.id}</Title>
        <Text>We have {order.items.map((item) => item.name).join(", ")}.</Text>
        <Text style={{ marginVertical: 8 }}>Total {order.symbol}{order.subtotal} · {order.status}</Text>
        <Button label="Back to the house" onPress={() => navigation.navigate("Main")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title kicker="Checkout">Where should it go?</Title>
      {["name", "phone", "line1", "city", "country", "note"].map((key) => (
        <TextInput key={key} value={form[key]} onChangeText={(value) => set(key, value)} placeholder={key} style={styles.input} placeholderTextColor={colors.muted} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Place the order" onPress={place} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontWeight: "600", color: colors.ink },
  qty: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  total: { fontSize: 20, fontWeight: "600", color: colors.ink },
  muted: { color: colors.muted },
  error: { color: colors.maroon, marginBottom: 8 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginBottom: 8 },
});
