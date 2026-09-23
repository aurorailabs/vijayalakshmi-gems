import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Screen, Title, colors } from "../ui";

export default function AccountScreen({ navigation }) {
  const { user, signIn, signOut } = useStore();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "meera@vijayalakshmi.local", password: "Demo@123", phone: "" });
  const [error, setError] = useState("");

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const result = await api(path, { method: "POST", body: form });
      await signIn(result.token, result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) {
    return (
      <Screen>
        <Title kicker="Account" sub="Orders, the bag, and the saved list live on your account.">{mode === "login" ? "Sign in" : "Create an account"}</Title>
        {mode === "register" ? <Field label="Name" value={form.name} onChangeText={(value) => set("name", value)} /> : null}
        <Field label="Email" value={form.email} onChangeText={(value) => set("email", value)} autoCapitalize="none" />
        <Field label="Password" value={form.password} onChangeText={(value) => set("password", value)} secureTextEntry />
        {mode === "register" ? <Field label="Phone" value={form.phone} onChangeText={(value) => set("phone", value)} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={mode === "login" ? "Sign in" : "Create account"} onPress={submit} />
        <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: 14 }}>
          <Text style={styles.link}>{mode === "login" ? "New here? Create an account" : "Already registered? Sign in"}</Text>
        </Pressable>
        <Text style={styles.hint}>Sample shopper: meera@vijayalakshmi.local / Demo@123</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title kicker="Account" sub={user.email}>{user.name}</Title>
      <View style={{ gap: 10 }}>
        <Button label="Saved pieces" onPress={() => navigation.navigate("Wishlist")} />
        <Button ghost label="Orders" onPress={() => navigation.navigate("Orders")} />
        <Button ghost label="Shipping and help" onPress={() => navigation.navigate("Help")} />
        <Button ghost label="Talk to the desk" onPress={() => navigation.navigate("Enquire", { type: "expert" })} />
        <Button ghost label="Sign out" onPress={signOut} />
      </View>
    </Screen>
  );
}

export function WishlistScreen({ navigation }) {
  const { currency } = useStore();
  const [items, setItems] = useState(null);
  useEffectLoad(async () => {
    const data = await api("/api/wishlist", { currency });
    setItems(data.items);
  });
  return (
    <Screen>
      <Title>Saved</Title>
      {(items || []).map((item) => (
        <Pressable key={item.id} onPress={() => navigation.navigate("Product", { slug: item.slug })} style={styles.line}>
          <Text style={styles.name}>{item.name}</Text>
        </Pressable>
      ))}
      {items && !items.length ? <Text style={styles.hint}>Nothing saved yet.</Text> : null}
    </Screen>
  );
}

export function OrdersScreen() {
  const [items, setItems] = useState([]);
  useEffectLoad(async () => {
    const data = await api("/api/orders");
    setItems(data.items);
  });
  return (
    <Screen>
      <Title>Orders</Title>
      {items.map((order) => (
        <View key={order.id} style={styles.line}>
          <Text style={styles.name}>#{order.id} · {order.status}</Text>
          <Text>{order.items.map((item) => item.name).join(", ")}</Text>
          <Text>{order.symbol}{order.subtotal}</Text>
        </View>
      ))}
    </Screen>
  );
}

export function HelpScreen({ navigation }) {
  const [pages, setPages] = useState([]);
  useEffectLoad(async () => {
    const data = await api("/api/bootstrap");
    setPages(data.pages || []);
  });
  return (
    <Screen>
      <Title>Help</Title>
      {pages.map((page) => (
        <Pressable key={page.slug} onPress={() => navigation.navigate("Page", { slug: page.slug })} style={styles.line}>
          <Text style={styles.name}>{page.title}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

export function PageScreen({ route }) {
  const [page, setPage] = useState(null);
  useEffectLoad(async () => {
    const data = await api(`/api/pages/${route.params.slug}`);
    setPage(data.page);
  });
  if (!page) return <Screen><Text>Opening…</Text></Screen>;
  return <Screen><Title>{page.title}</Title><Text style={styles.body}>{page.body}</Text></Screen>;
}

export function ArticleScreen({ route }) {
  const [post, setPost] = useState(null);
  useEffectLoad(async () => {
    const data = await api(`/api/blog/${route.params.slug}`);
    setPost(data.post);
  });
  if (!post) return <Screen><Text>Opening…</Text></Screen>;
  return <Screen><Title sub={post.excerpt}>{post.title}</Title><Text style={styles.body}>{post.body}</Text></Screen>;
}

export function EnquireScreen({ route }) {
  const { user } = useStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    message: route.params?.message || "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const type = route.params?.type || "expert";

  async function send() {
    setError("");
    try {
      await api("/api/enquiries", {
        method: "POST",
        body: { ...form, type, productId: route.params?.productId || null },
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (done) return <Screen><Title>The desk has it</Title><Text>We will use the phone number you left.</Text></Screen>;
  return (
    <Screen>
      <Title kicker={type.replace(/_/g, " ")} sub={route.params?.productName || "Tell us what you need."}>Write to the desk</Title>
      {["name", "phone", "email", "message"].map((key) => (
        <TextInput key={key} value={form[key]} onChangeText={(value) => setForm({ ...form, [key]: value })} placeholder={key} style={styles.input} placeholderTextColor={colors.muted} multiline={key === "message"} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send" onPress={send} />
    </Screen>
  );
}

function Field(props) {
  return <TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} />;
}

function useEffectLoad(loader) {
  useEffect(() => {
    loader().catch(() => {});
  }, []);
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginBottom: 8 },
  error: { color: colors.maroon, marginBottom: 8 },
  link: { color: colors.maroon },
  hint: { color: colors.muted, marginTop: 18 },
  line: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontWeight: "600", color: colors.ink, fontSize: 16 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
});
