import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

const emptyAddress = { name: "", phone: "", line1: "", line2: "", city: "", state: "", postal: "", country: "India" };

export function CheckoutScreen({ navigation }) {
  const { ready, user, currency } = useStore();
  const [options, setOptions] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [form, setForm] = useState(emptyAddress);
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({ ...current, name: current.name || user.name || "", phone: current.phone || user.phone || "" }));
  }, [user]);

  const load = useCallback(() => {
    if (!user) return;
    api("/api/checkout/options", { currency }).then(setOptions).catch((err) => setError(err.message));
    api("/api/addresses").then((data) => {
      setAddresses(data.items);
      const preferred = data.items.find((item) => item.isDefault) || data.items[0];
      if (preferred) setAddressId(preferred.id);
    }).catch((err) => setError(err.message));
  }, [user, currency]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user) return;
    api("/api/checkout/quote", { method: "POST", currency, body: { coupon: applied, shippingMethod } })
      .then(setQuote)
      .catch((err) => setError(err.message));
  }, [user, currency, applied, shippingMethod]);

  function set(key, value) {
    setAddressId(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function place() {
    setError("");
    setBusy(true);
    try {
      const body = {
        coupon: applied,
        shippingMethod,
        paymentMethod,
        note,
        saveAddress: !addressId && saveAddress,
      };
      if (addressId) body.addressId = addressId;
      else body.shipping = form;
      const data = await api("/api/checkout", { method: "POST", currency, body });
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Screen><Text>Opening checkout…</Text></Screen>;
  if (!user) {
    return (
      <Screen>
        <Title kicker="Checkout">Sign in to place the order</Title>
        <Button label="Sign in" onPress={() => navigation.navigate("SignIn")} />
      </Screen>
    );
  }
  if (order) {
    return (
      <Screen>
        <Title kicker="Placed">Order #{order.id}</Title>
        <Text>We have {order.items.map((item) => item.name).join(", ")}.</Text>
        <Text style={styles.total}>Total {order.symbol}{order.total}</Text>
        <Text style={styles.muted}>{order.paymentName} · {order.paymentStatus}</Text>
        <Button label="See the order" onPress={() => navigation.replace("Order", { id: order.id })} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title kicker="Checkout" sub="Delivery, tax, and the offer are counted before you place the order.">Where should it go?</Title>
      {addresses.map((item) => (
        <Pressable key={item.id} onPress={() => setAddressId(item.id)} style={[styles.choice, addressId === item.id && styles.choiceOn]}>
          <Text style={styles.name}>{item.label || "Saved"} · {item.name}</Text>
          <Text style={styles.muted}>{item.line1}, {item.city} {item.postal}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setAddressId(null)} style={[styles.choice, !addressId && styles.choiceOn]}>
        <Text style={styles.name}>Use a new address</Text>
      </Pressable>
      {!addressId ? (
        <View>
          {[
            ["name", "Name"],
            ["phone", "Phone"],
            ["line1", "Address"],
            ["line2", "Apartment, optional"],
            ["city", "City"],
            ["state", "State"],
            ["postal", "Postal code"],
            ["country", "Country"],
          ].map(([key, label]) => (
            <Field key={key} label={label} value={form[key]} onChangeText={(value) => set(key, value)} />
          ))}
          <Pressable onPress={() => setSaveAddress((value) => !value)} style={styles.check}>
            <Text>{saveAddress ? "Saved on the account" : "Save this address"}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Delivery</Text>
      {(options?.shipping || []).map((item) => (
        <Pressable key={item.id} onPress={() => setShippingMethod(item.id)} style={[styles.choice, shippingMethod === item.id && styles.choiceOn]}>
          <Text style={styles.name}>{item.name} · {item.symbol}{item.price}</Text>
          <Text style={styles.muted}>{item.detail}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Offer code</Text>
      <Field label="Code" value={coupon} onChangeText={setCoupon} autoCapitalize="characters" />
      <Button ghost label="Apply code" onPress={() => setApplied(coupon.trim())} />
      {quote?.couponError ? <Text style={styles.error}>{quote.couponError}</Text> : null}
      {quote?.couponCode ? <Text style={styles.good}>{quote.couponCode} is on this order.</Text> : null}
      <Text style={styles.muted}>Try WELCOME10 for 10% off, or GEM50 for $50 off orders of $200 or more.</Text>

      <Text style={styles.section}>Payment</Text>
      {(options?.payments || []).map((item) => (
        <Pressable key={item.id} onPress={() => setPaymentMethod(item.id)} style={[styles.choice, paymentMethod === item.id && styles.choiceOn]}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.muted}>{item.detail}</Text>
        </Pressable>
      ))}
      <Field label="Note for the desk" value={note} onChangeText={setNote} />

      {quote ? (
        <View style={styles.totals}>
          <Line label="Pieces" value={`${quote.symbol}${quote.subtotal}`} />
          {quote.discount ? <Line label="Offer" value={`− ${quote.symbol}${quote.discount}`} /> : null}
          <Line label="Delivery" value={`${quote.symbol}${quote.shipping}`} />
          <Line label={`GST ${quote.taxPercent}%`} value={`${quote.symbol}${quote.tax}`} />
          <Text style={styles.total}>To pay {quote.symbol}{quote.total}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? "Placing…" : "Place the order"} onPress={place} disabled={busy} />
    </Screen>
  );
}

export function OrderScreen({ navigation, route }) {
  const { user } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    api(`/api/orders/${route.params.id}`).then((data) => setOrder(data.order)).catch((err) => setError(err.message));
  }, [user, route.params.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/orders/${route.params.id}/cancel`, { method: "POST" });
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <Screen safe={false}><Title>Sign in to see this order</Title><Button label="Sign in" onPress={() => navigation.navigate("SignIn")} /></Screen>;
  }
  if (!order) return <Screen safe={false}><Text>{error || "Opening the order…"}</Text></Screen>;

  return (
    <Screen safe={false}>
      <Title kicker={order.status} sub={`${order.paymentName} · ${order.paymentStatus}`}>Order #{order.id}</Title>
      {order.items.map((item) => (
        <View key={`${item.sku}-${item.name}`} style={styles.lineRow}>
          <Text style={styles.name}>{item.qty} × {item.name}</Text>
          <Text>{order.symbol}{item.line}</Text>
        </View>
      ))}
      <View style={styles.totals}>
        <Line label="Pieces" value={`${order.symbol}${order.subtotal}`} />
        {order.discount ? <Line label={order.couponCode || "Offer"} value={`− ${order.symbol}${order.discount}`} /> : null}
        <Line label={order.shippingName || "Delivery"} value={`${order.symbol}${order.shipping}`} />
        <Line label="GST" value={`${order.symbol}${order.tax}`} />
        <Text style={styles.total}>To pay {order.symbol}{order.total}</Text>
      </View>
      <Text style={styles.section}>Ship to</Text>
      <Text>{order.shipName}</Text>
      <Text style={styles.muted}>{[order.shipLine1, order.shipLine2, order.shipCity, order.shipState, order.shipPostal, order.shipCountry].filter(Boolean).join(", ")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {order.status === "placed" ? <Button ghost label={busy ? "Cancelling…" : "Cancel this order"} onPress={cancel} disabled={busy} /> : null}
    </Screen>
  );
}

export function AddressesScreen({ navigation }) {
  const { user } = useStore();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    api("/api/addresses").then((data) => setItems(data.items)).catch((err) => setError(err.message));
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    setError("");
    try {
      await api("/api/addresses", { method: "POST", body: form });
      setForm({ ...emptyAddress, name: user?.name || "", phone: user?.phone || "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) return <Screen safe={false}><Title>Sign in to save an address</Title><Button label="Sign in" onPress={() => navigation.navigate("SignIn")} /></Screen>;

  return (
    <Screen safe={false}>
      <Title kicker="Account">Addresses</Title>
      {items.map((item) => (
        <View key={item.id} style={styles.choice}>
          <Text style={styles.name}>{item.name}{item.isDefault ? " · Default" : ""}</Text>
          <Text style={styles.muted}>{item.line1}, {item.city} {item.postal}</Text>
          <View style={styles.row}>
            {!item.isDefault ? <Button ghost label="Make default" onPress={() => api(`/api/addresses/${item.id}`, { method: "PATCH", body: { isDefault: true } }).then(load)} /> : null}
            <Button ghost label="Remove" onPress={() => api(`/api/addresses/${item.id}`, { method: "DELETE" }).then(load)} />
          </View>
        </View>
      ))}
      <Text style={styles.section}>Add an address</Text>
      {[["name", "Name"], ["phone", "Phone"], ["line1", "Address"], ["city", "City"], ["state", "State"], ["postal", "Postal code"], ["country", "Country"]].map(([key, label]) => (
        <Field key={key} label={label} value={form[key]} onChangeText={(value) => setForm({ ...form, [key]: value })} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save address" onPress={save} />
    </Screen>
  );
}

export function ProfileScreen() {
  const { user, updateUser } = useStore();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [passwords, setPasswords] = useState({ current: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveDetails() {
    setError("");
    setMessage("");
    try {
      const data = await api("/api/auth/profile", { method: "PATCH", body: form });
      updateUser(data.user);
      setMessage("Your details are saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassword() {
    setError("");
    setMessage("");
    try {
      await api("/api/auth/password", { method: "POST", body: passwords });
      setPasswords({ current: "", password: "" });
      setMessage("The password is changed.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) return <Screen safe={false}><Text>Sign in to edit your account.</Text></Screen>;

  return (
    <Screen safe={false}>
      <Title kicker="Account" sub={user.email}>{user.name}</Title>
      <Field label="Name" value={form.name} onChangeText={(value) => setForm({ ...form, name: value })} />
      <Field label="Phone" value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} keyboardType="phone-pad" />
      <Button label="Save details" onPress={saveDetails} />
      <Text style={styles.section}>Password</Text>
      <Field label="Current password" value={passwords.current} onChangeText={(value) => setPasswords({ ...passwords, current: value })} secureTextEntry />
      <Field label="New password" value={passwords.password} onChangeText={(value) => setPasswords({ ...passwords, password: value })} secureTextEntry />
      <Button ghost label="Change password" onPress={savePassword} />
      {message ? <Text style={styles.good}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function Line({ label, value }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: colors.paper },
  choiceOn: { borderColor: colors.maroon },
  name: { fontWeight: "600", color: colors.ink },
  muted: { color: colors.muted, marginTop: 2 },
  section: { marginTop: 18, marginBottom: 8, fontSize: 18, fontWeight: "600", color: colors.ink },
  label: { color: colors.ink, fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 },
  check: { marginBottom: 8 },
  totals: { marginTop: 16, marginBottom: 12, gap: 6 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  total: { fontSize: 20, fontWeight: "600", color: colors.ink, marginTop: 8 },
  error: { color: colors.maroon, marginVertical: 8 },
  good: { color: "#1f6b3a", marginVertical: 8, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
});
