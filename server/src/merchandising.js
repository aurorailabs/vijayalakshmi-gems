import { getSettings, run, setSetting } from "./db.js";

function photo(id) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;
}

const productPhotos = {
  "ceylon-yellow-sapphire-3-2ct": "1617038260897-41a1f14a8ca0",
  "yellow-sapphire-gold-ring": "1617038260897-41a1f14a8ca0",
  "honey-hessonite-4-5ct": "1611591437281-460bfbe1220a",
  "cornflower-blue-sapphire-2-4ct": "1535632066927-ab7c9ab60908",
  "blue-sapphire-pendant": "1599643478518-a784e5dc4c8f",
  "vault-royal-blue-sapphire": "1630019852942-f89202989a59",
  "tanzanite-oval-4ct": "1630019852942-f89202989a59",
  "aquamarine-emerald-cut-5ct": "1599643478518-a784e5dc4c8f",
  "zambia-emerald-1-8ct": "1757033534533-f3d0036d8504",
  "emerald-everyday-ring": "1583937443351-f2f669fbe2cf",
  "emerald-matched-pair-2-7ct": "1757033534533-f3d0036d8504",
  "emerald-brooch": "1583937443351-f2f669fbe2cf",
  "vault-russian-alexandrite": "1583937443351-f2f669fbe2cf",
  "mozambique-ruby-2-1ct": "1551122102-63cd339bfaab",
  "ruby-engagement-ring": "1761754642919-207d8dd8d1e2",
  "limited-ruby-3ct": "1617117811969-97f441511dee",
  "limited-garnet-ring": "1617117811969-97f441511dee",
  "italian-red-coral-5-5ct": "1667013829921-b1c1719a0cfa",
  "red-coral-silver-pendant": "1667013829921-b1c1719a0cfa",
  "freshwater-pearl-7mm": "1515562141207-7a88fb7ce338",
  "pearl-line-bracelet": "1515562141207-7a88fb7ce338",
  "white-sapphire-2-6ct": "1599707367072-cd6ada2bc375",
  "amethyst-cushion-6ct": "1667013829325-be7dac7d03eb",
  "ethiopian-opal-3-4ct": "1601121141461-9d6647bca1ed",
  "navratna-nine-stone-layout": "1601121141461-9d6647bca1ed",
  "chrysoberyl-cats-eye-3-1ct": "1617038260897-41a1f14a8ca0",
  "temple-gold-cuff": "1611591437281-460bfbe1220a",
  "vault-padparadscha": "1603561591411-07134e71a2a9",
};

const bannerPhotos = {
  "Stones with a reason": "1761754642919-207d8dd8d1e2",
  "The vault is open": "1535632066927-ab7c9ab60908",
  "A stone for this season": "1551122102-63cd339bfaab",
};

export function dressWindows() {
  const refresh = getSettings().photo_set !== 2;
  const productClause = refresh
    ? "slug = ?"
    : "slug = ? AND (image_url IS NULL OR image_url = '')";
  const bannerClause = refresh
    ? "title = ?"
    : "title = ? AND (image_url IS NULL OR image_url = '')";
  for (const [slug, id] of Object.entries(productPhotos)) {
    run(`UPDATE products SET image_url = ? WHERE ${productClause}`, photo(id), slug);
  }
  for (const [title, id] of Object.entries(bannerPhotos)) {
    run(`UPDATE banners SET image_url = ? WHERE ${bannerClause}`, photo(id), title);
  }
  if (refresh) setSetting("photo_set", 2);
}
