import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, GemCard, Screen, Title, colors, openTarget } from "../ui";

export default function HomeScreen({ navigation }) {
  const { currency, setCurrency } = useStore();
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api("/api/bootstrap", { currency }).then((next) => live && setData(next)).catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [currency]);

  if (error) return <Screen><Text style={styles.error}>{error}</Text></Screen>;
  if (!data) return <Screen><Text>Opening the atelier…</Text></Screen>;

  const settings = data.settings || {};
  const stories = (data.blocks || []).filter((block) => block.groupName === "home");
  const steps = (data.blocks || []).filter((block) => block.groupName === "custom_steps");
  const collections = (data.navigation || []).find((item) => item.slug === "collections");

  return (
    <Screen>
      <Text style={styles.brand}>{settings.brand || "Vijayalakshmi Gems"}</Text>
      <Title sub={settings.tagline}>{data.blocks?.find((block) => block.blockKey === "home_intro")?.title || "Find your stone"}</Title>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {data.currencies.map((item) => (
          <Pressable key={item.code} onPress={() => setCurrency(item.code)} style={[styles.chip, item.code === currency && styles.chipOn]}>
            <Text style={item.code === currency ? styles.chipOnText : styles.chipText}>{item.code}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.searchRow}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search a gem, origin, or metal" style={styles.search} placeholderTextColor={colors.muted} />
        <Button label="Search" onPress={() => navigation.navigate("Shop", { q: query })} />
      </View>

      {data.banners.map((banner) => (
        <Pressable key={banner.id} onPress={() => openTarget(navigation, banner.ctaTarget)} style={[styles.banner, { backgroundColor: banner.swatch || colors.maroon }]}>
          <Text style={styles.bannerTitle}>{banner.title}</Text>
          <Text style={styles.bannerSub}>{banner.subtitle}</Text>
          {banner.ctaLabel ? <Text style={styles.bannerCta}>{banner.ctaLabel}</Text> : null}
        </Pressable>
      ))}

      <Text style={styles.section}>By purpose</Text>
      <View style={styles.wrap}>
        {data.purposes.map((purpose) => (
          <Pressable key={purpose.slug} style={styles.purpose} onPress={() => navigation.navigate("Shop", { purpose: purpose.slug, title: purpose.name })}>
            <Text style={styles.purposeName}>{purpose.name}</Text>
            <Text style={styles.purposeGem}>{purpose.gemstone}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Stones of the house</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {data.featured.map((item) => (
          <GemCard key={item.id} item={item} onPress={() => navigation.navigate("Product", { slug: item.slug })} />
        ))}
      </ScrollView>

      <Text style={styles.section}>Jewellery selling now</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {data.bestsellers.map((item) => (
          <GemCard key={item.id} item={item} onPress={() => navigation.navigate("Product", { slug: item.slug })} />
        ))}
      </ScrollView>

      <Text style={styles.section}>Departments</Text>
      {(data.navigation || []).map((item) => (
        <Pressable key={item.id} style={styles.dept} onPress={() => navigation.navigate("Shop", { category: item.slug, title: item.name })}>
          <Text style={styles.deptName}>{item.name}</Text>
          <Text style={styles.deptMeta}>{(item.children || []).slice(0, 4).map((child) => child.name).join(" · ")}</Text>
        </Pressable>
      ))}

      {collections ? (
        <View style={styles.wrap}>
          {collections.children.map((item) => (
            <Pressable key={item.id} style={styles.purpose} onPress={() => navigation.navigate("Shop", { collection: item.slug, title: item.name })}>
              <Text style={styles.purposeName}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {stories.filter((block) => block.blockKey !== "home_intro").map((block) => (
        <View key={block.id} style={styles.story}>
          <Text style={styles.storyTitle}>{block.title}</Text>
          <Text style={styles.sub}>{block.body}</Text>
          {block.ctaLabel ? <Button label={block.ctaLabel} onPress={() => openTarget(navigation, block.ctaTarget)} /> : null}
        </View>
      ))}

      {steps.length ? (
        <View style={styles.story}>
          <Text style={styles.storyTitle}>A piece made for one person</Text>
          {steps.map((step, index) => (
            <Text key={step.id} style={styles.step}>{index + 1}. {step.title} — {step.body}</Text>
          ))}
          <Button label="Book a session" onPress={() => navigation.navigate("Enquire", { type: "custom_design" })} />
        </View>
      ) : null}

      <Text style={styles.section}>From the bench</Text>
      {data.reviews.map((review) => (
        <View key={review.id} style={styles.review}>
          <Text style={styles.storyTitle}>{review.title}</Text>
          <Text style={styles.sub}>{review.body}</Text>
          <Text style={styles.deptMeta}>{review.author} · {review.rating}/5</Text>
        </View>
      ))}

      <Text style={styles.section}>Journal</Text>
      {data.posts.map((post) => (
        <Pressable key={post.slug} onPress={() => navigation.navigate("Article", { slug: post.slug })}>
          <Text style={styles.storyTitle}>{post.title}</Text>
          <Text style={styles.sub}>{post.excerpt}</Text>
        </Pressable>
      ))}

      <View style={styles.story}>
        <Text style={styles.storyTitle}>{settings.company}</Text>
        <Text style={styles.sub}>{settings.sales_hours}</Text>
        <Text style={styles.sub}>{settings.support_hours}</Text>
        {(settings.phones || []).map((phone) => <Text key={phone.label} style={styles.sub}>{phone.label}: {phone.value}</Text>)}
        {(settings.locations || []).map((place) => <Text key={place.city} style={styles.sub}>{place.city} — {place.lines}</Text>)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.gold, letterSpacing: 1.4, textTransform: "uppercase", fontSize: 12, marginBottom: 8 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 16 },
  search: { flex: 1, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink },
  chipOnText: { color: colors.paper },
  banner: { borderRadius: 18, padding: 18, marginBottom: 10 },
  bannerTitle: { color: "#fffaf3", fontSize: 24, fontWeight: "600" },
  bannerSub: { color: "#fffaf3", marginTop: 6 },
  bannerCta: { color: "#fffaf3", marginTop: 12, fontWeight: "700" },
  section: { marginTop: 22, marginBottom: 10, fontSize: 20, color: colors.ink, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  purpose: { backgroundColor: colors.paper, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.line, minWidth: "47%" },
  purposeName: { color: colors.ink, fontWeight: "600" },
  purposeGem: { color: colors.maroon, marginTop: 2 },
  dept: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  deptName: { fontSize: 18, color: colors.ink, fontWeight: "600" },
  deptMeta: { color: colors.muted, marginTop: 2 },
  story: { backgroundColor: colors.paper, borderRadius: 16, padding: 16, marginTop: 14, gap: 8 },
  storyTitle: { fontSize: 18, color: colors.ink, fontWeight: "600" },
  sub: { color: colors.muted },
  step: { color: colors.ink },
  review: { marginBottom: 12 },
  error: { color: colors.maroon },
});
