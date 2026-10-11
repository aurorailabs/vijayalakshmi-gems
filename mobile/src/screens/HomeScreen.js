import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, photoUri } from "../api";
import { useStore } from "../store";
import { GemCard, Screen, colors, openTarget, useShopWidth } from "../ui";

export default function HomeScreen({ navigation }) {
  const { currency, theme, setTheme, setFooter } = useStore();
  const { card } = useShopWidth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api("/api/bootstrap", { currency })
      .then((next) => {
        if (!live) return;
        setData(next);
        if (next.screen?.theme) setTheme((current) => ({ ...current, ...next.screen.theme }));
        if (next.screen?.footer) setFooter(next.screen.footer);
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [currency]);

  if (error) return <Screen><Text style={styles.error}>{error}</Text></Screen>;
  if (!data?.screen) return <Screen><Text>Opening the atelier…</Text></Screen>;

  const screen = data.screen;
  const paper = theme.paper || colors.paper;
  const accent = theme.accent || colors.maroon;
  const openPiece = (item) => {
    if (item?.slug) navigation.navigate("Product", { slug: item.slug });
  };
  const openSlide = (slide) => {
    if (slide.productSlug) navigation.navigate("Product", { slug: slide.productSlug });
    else openTarget(navigation, slide.ctaTarget);
  };
  const promos = (screen.promotions.items || []).filter((item) => item.imageUrl);
  const ads = (screen.ads.items || []).filter((item) => item.imageUrl);

  return (
    <Screen>
      {screen.title.show ? <Text style={styles.title}>{screen.title.text}</Text> : null}
      {screen.description.show ? <Text style={styles.description}>{screen.description.text}</Text> : null}

      {screen.promotions.show && promos.length ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
          {promos.map((slide) => (
            <Pressable key={slide.id} onPress={() => openSlide(slide)} style={[styles.promo, { backgroundColor: paper }]}>
              <Image source={{ uri: photoUri(slide.imageUrl) }} style={styles.promoPhoto} resizeMode="contain" />
              {slide.title ? <Text style={styles.promoTitle}>{slide.title}</Text> : null}
              {slide.subtitle ? <Text style={styles.promoSub}>{slide.subtitle}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {screen.ads.show && ads.length ? (
        <View style={styles.ads}>
          {ads.map((ad) => (
            <Pressable key={ad.id} onPress={() => openSlide(ad)} style={[styles.ad, { backgroundColor: paper }]}>
              <Image source={{ uri: photoUri(ad.imageUrl) }} style={styles.adPhoto} resizeMode="cover" />
              {ad.title ? <Text style={styles.adTitle}>{ad.title}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {screen.gemstones.show ? (
        <Shelf title={screen.gemstones.title} description={screen.gemstones.description} accent={accent} onAll={() => navigation.navigate("Shop", { category: "gemstones", title: screen.gemstones.title })}>
          {screen.gemstones.products.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
        </Shelf>
      ) : null}

      {screen.jewellery.show ? (
        <Shelf title={screen.jewellery.title} description={screen.jewellery.description} accent={accent} onAll={() => navigation.navigate("Shop", { category: "jewellery", title: screen.jewellery.title })}>
          {screen.jewellery.products.map((item) => <GemCard key={item.id} item={item} width={card} onPress={() => openPiece(item)} />)}
        </Shelf>
      ) : null}
    </Screen>
  );
}

function Shelf({ title, description, accent, onAll, children }) {
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shelfTitle}>{title}</Text>
          {description ? <Text style={styles.shelfSub}>{description}</Text> : null}
        </View>
        <Pressable onPress={onAll}><Text style={[styles.link, { color: accent }]}>See all</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 34, fontWeight: "600", lineHeight: 40 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 6, marginBottom: 14 },
  promoScroll: { marginTop: 8 },
  promo: { width: 320, borderRadius: 22, overflow: "hidden", marginRight: 12, borderWidth: 1, borderColor: colors.line },
  promoPhoto: { width: 320, height: 190, backgroundColor: "#fff" },
  promoTitle: { color: colors.ink, fontSize: 18, fontWeight: "700", paddingHorizontal: 14, paddingTop: 10 },
  promoSub: { color: colors.muted, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  ads: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  ad: { flexGrow: 1, flexBasis: 160, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  adPhoto: { width: "100%", height: 120, backgroundColor: "#fff" },
  adTitle: { color: colors.ink, fontWeight: "700", padding: 12 },
  shelf: { marginTop: 18 },
  shelfHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10, gap: 12 },
  shelfTitle: { color: colors.ink, fontSize: 26, fontWeight: "600" },
  shelfSub: { color: colors.muted, marginTop: 2 },
  shelfRow: { gap: 14, paddingRight: 8 },
  link: { fontWeight: "700", marginBottom: 6 },
  error: { color: colors.maroon },
});
