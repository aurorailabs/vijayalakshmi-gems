import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useStore } from "../store";
import { Button, GemCard, Screen, colors, openTarget, useShopWidth } from "../ui";

export default function HomeScreen({ navigation }) {
  const { currency, setCurrency } = useStore();
  const { card } = useShopWidth();
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
  const intro = (data.blocks || []).find((block) => block.blockKey === "home_intro");
  const hero = data.banners[0];
  const rest = data.banners.slice(1);
  const stories = (data.blocks || []).filter((block) => ["certified", "energize", "trust"].includes(block.blockKey));
  const steps = (data.blocks || []).filter((block) => block.groupName === "custom_steps");
  const openPiece = (item) => navigation.navigate("Product", { slug: item.slug });

  return (
    <Screen>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>{settings.brand || "Vijayalakshmi Gems"}</Text>
          <Text style={styles.tag}>{settings.tagline}</Text>
        </View>
        <View style={styles.currencies}>
          {data.currencies.map((item) => (
            <Pressable key={item.code} onPress={() => setCurrency(item.code)} style={[styles.chip, item.code === currency && styles.chipOn]}>
              <Text style={item.code === currency ? styles.chipOnText : styles.chipText}>{item.code}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {hero ? (
        <Pressable onPress={() => openTarget(navigation, hero.ctaTarget)} style={styles.hero} accessibilityRole="button" accessibilityLabel={hero.title}>
          {hero.imageUrl ? <Image source={{ uri: hero.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.heroShade} />
          <Text style={styles.heroKicker}>Ready to wear</Text>
          <Text style={styles.heroTitle}>{hero.title}</Text>
          <Text style={styles.heroSub}>{hero.subtitle}</Text>
          {hero.ctaLabel ? <Text style={styles.heroCta}>{hero.ctaLabel}</Text> : null}
        </Pressable>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search a gem, a ring, an origin" style={styles.search} placeholderTextColor={colors.muted} />
        <Button label="Search" onPress={() => navigation.navigate("Shop", { q: query, title: query || "Search" })} />
      </View>

      {(data.shops || []).length ? (
        <>
          <Text style={styles.section}>Shops</Text>
          <Text style={styles.lead}>One app for every shop. Open a shop to see only its stones and jewellery.</Text>
          <View style={styles.wrap}>
            {data.shops.map((shop) => (
              <Pressable key={shop.id} style={styles.purpose} onPress={() => navigation.navigate("Shop", { shop: shop.slug, title: shop.name })}>
                <Text style={styles.purposeName}>{shop.name}</Text>
                <Text style={styles.purposeGem}>{shop.city || "View pieces"}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.trustRow}>
        {stories.map((block) => (
          <Pressable key={block.id} style={styles.trust} onPress={() => block.ctaTarget && openTarget(navigation, block.ctaTarget)}>
            <Text style={styles.trustTitle}>{block.title}</Text>
            <Text style={styles.trustBody} numberOfLines={3}>{block.body}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Shop by what you want</Text>
      <Text style={styles.lead}>{intro?.body}</Text>
      <View style={styles.wrap}>
        {data.purposes.map((purpose) => (
          <Pressable key={purpose.slug} style={styles.purpose} onPress={() => navigation.navigate("Shop", { purpose: purpose.slug, title: purpose.name })}>
            <Text style={styles.purposeName}>{purpose.name}</Text>
            <Text style={styles.purposeGem}>{purpose.gemstone}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Stones in the window</Text>
        <Pressable onPress={() => navigation.navigate("Shop", { category: "gemstones", title: "Gemstones" })}><Text style={styles.link}>Shop all</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {data.featured.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Jewellery people are buying</Text>
        <Pressable onPress={() => navigation.navigate("Shop", { category: "jewellery", title: "Jewellery" })}><Text style={styles.link}>See jewellery</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {data.bestsellers.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
      </View>

      {(data.limited || []).length ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Lower this week</Text>
            <Pressable onPress={() => navigation.navigate("Shop", { limited: "1", title: "Limited" })}><Text style={styles.link}>All specials</Text></Pressable>
          </View>
          <View style={styles.grid}>
            {data.limited.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
          </View>
        </>
      ) : null}

      <View style={styles.bannerRow}>
        {rest.map((banner) => (
          <Pressable key={banner.id} onPress={() => openTarget(navigation, banner.ctaTarget)} style={styles.sideBanner}>
            {banner.imageUrl ? <Image source={{ uri: banner.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={styles.heroShade} />
            <Text style={styles.sideTitle}>{banner.title}</Text>
            <Text style={styles.sideSub}>{banner.subtitle}</Text>
            {banner.ctaLabel ? <Text style={styles.heroCta}>{banner.ctaLabel}</Text> : null}
          </Pressable>
        ))}
      </View>

      {(data.vault || []).length ? (
        <>
          <Text style={styles.section}>The vault</Text>
          <Text style={styles.lead}>Rare stones. The desk names the price.</Text>
          <View style={styles.grid}>
            {data.vault.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
          </View>
        </>
      ) : null}

      <Text style={styles.section}>What buyers wrote</Text>
      <View style={styles.grid}>
        {data.reviews.slice(0, 4).map((review) => (
          <View key={review.id} style={[styles.review, { width: card }]}>
            <Text style={styles.stars}>{"★".repeat(review.rating)}</Text>
            <Text style={styles.reviewTitle}>{review.title}</Text>
            <Text style={styles.trustBody} numberOfLines={4}>{review.body}</Text>
            <Text style={styles.reviewAuthor}>{review.author}</Text>
          </View>
        ))}
      </View>

      {steps.length ? (
        <View style={styles.custom}>
          <Text style={styles.section}>Made for one person</Text>
          {steps.map((step, index) => (
            <Text key={step.id} style={styles.step}><Text style={styles.stepNo}>{index + 1}</Text>  {step.title}. {step.body}</Text>
          ))}
          <Button label="Book a drawing" onPress={() => navigation.navigate("Enquire", { type: "custom_design" })} />
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.trustTitle}>{settings.company}</Text>
        <Text style={styles.trustBody}>{settings.sales_hours}</Text>
        <Text style={styles.trustBody}>{settings.support_hours}</Text>
        {(settings.phones || []).map((phone) => <Text key={phone.label} style={styles.trustBody}>{phone.label} {phone.value}</Text>)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" },
  brand: { color: colors.gold, letterSpacing: 1.8, textTransform: "uppercase", fontSize: 12, fontWeight: "700" },
  tag: { color: colors.ink, fontSize: 22, fontWeight: "600", maxWidth: 520, marginTop: 4 },
  currencies: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink },
  chipOnText: { color: colors.paper },
  hero: { minHeight: 320, borderRadius: 24, overflow: "hidden", padding: 24, justifyContent: "flex-end", marginBottom: 16, backgroundColor: colors.maroon },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20, 10, 8, 0.42)" },
  heroKicker: { color: "#f3e2c2", letterSpacing: 1.4, textTransform: "uppercase", fontSize: 12, zIndex: 1 },
  heroTitle: { color: "#fffaf3", fontSize: 40, fontWeight: "600", marginTop: 6, zIndex: 1, maxWidth: 520 },
  heroSub: { color: "#fffaf3", marginTop: 8, fontSize: 16, maxWidth: 460, zIndex: 1 },
  heroCta: { color: "#fffaf3", marginTop: 14, fontWeight: "700", zIndex: 1 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 16 },
  search: { flex: 1, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12 },
  trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  trust: { flexGrow: 1, flexBasis: 220, backgroundColor: colors.paper, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line },
  trustTitle: { color: colors.ink, fontWeight: "700", marginBottom: 4 },
  trustBody: { color: colors.muted, lineHeight: 20 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 26, color: colors.ink, fontWeight: "600" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  lead: { color: colors.muted, marginBottom: 10, maxWidth: 640 },
  link: { color: colors.maroon, fontWeight: "700", marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  purpose: { backgroundColor: colors.paper, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  purposeName: { color: colors.ink, fontWeight: "700" },
  purposeGem: { color: colors.maroon, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  bannerRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  sideBanner: { flexGrow: 1, flexBasis: 280, minHeight: 210, borderRadius: 20, overflow: "hidden", padding: 18, justifyContent: "flex-end", backgroundColor: "#1d3f8f" },
  sideTitle: { color: "#fffaf3", fontSize: 24, fontWeight: "700", zIndex: 1 },
  sideSub: { color: "#fffaf3", marginTop: 4, zIndex: 1 },
  review: { backgroundColor: colors.paper, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line },
  stars: { color: colors.gold, marginBottom: 4 },
  reviewTitle: { color: colors.ink, fontWeight: "700", marginBottom: 4 },
  reviewAuthor: { color: colors.muted, marginTop: 8 },
  custom: { marginTop: 8, gap: 8 },
  step: { color: colors.ink, lineHeight: 22 },
  stepNo: { color: colors.maroon, fontWeight: "700" },
  footer: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 },
  error: { color: colors.maroon },
});
