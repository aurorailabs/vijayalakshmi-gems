import { hashPassword } from "./auth.js";
import { many, one, run, setSetting } from "./db.js";

function category({ parentId = null, slug, name, kind, group = null, description = "", sort = 0 }) {
  return run(
    `INSERT INTO categories (parent_id, slug, name, kind, group_name, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    parentId,
    slug,
    name,
    kind,
    group,
    description,
    sort,
  ).id;
}

function product(row) {
  run(
    `INSERT INTO products (
      sku, slug, name, category_id, collection_id, kind, summary, description, benefit,
      carat, shape, origin, treatment, certification, metal, jewellery_type, birth_month,
      price_cents, compare_cents, call_for_price, stock, swatch, is_featured, is_bestseller,
      is_limited, is_vault, purpose, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.sku,
    row.slug,
    row.name,
    row.categoryId,
    row.collectionId ?? null,
    row.kind,
    row.summary,
    row.description,
    row.benefit,
    row.carat ?? null,
    row.shape ?? null,
    row.origin ?? null,
    row.treatment ?? null,
    row.certification ?? null,
    row.metal ?? null,
    row.jewelleryType ?? null,
    row.birthMonth ?? null,
    row.priceCents ?? 0,
    row.compareCents ?? null,
    row.callForPrice ? 1 : 0,
    row.stock ?? 1,
    row.swatch,
    row.featured ? 1 : 0,
    row.bestseller ? 1 : 0,
    row.limited ? 1 : 0,
    row.vault ? 1 : 0,
    row.purpose ?? null,
    row.sort ?? 0,
  );
}

export function seed() {
  if (one("SELECT id FROM users LIMIT 1")) return;

  run(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    "Atelier Admin",
    "admin@vijayalakshmi.local",
    "+91 80 0000 1000",
    hashPassword("Admin@123"),
    "admin",
  );
  const customerId = run(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    "Meera Rao",
    "meera@vijayalakshmi.local",
    "+91 80 0000 1002",
    hashPassword("Demo@123"),
    "customer",
  ).id;

  const gems = category({
    slug: "gemstones",
    name: "Gemstones",
    kind: "gemstone",
    description: "Loose stones chosen for colour, origin, and wear.",
    sort: 1,
  });
  const jewellery = category({
    slug: "jewellery",
    name: "Jewellery",
    kind: "jewellery",
    description: "Rings, pendants, bracelets, and earrings set in our atelier.",
    sort: 2,
  });
  const collections = category({
    slug: "collections",
    name: "Collections",
    kind: "collection",
    description: "Pairs, bridal sets, and signature pieces.",
    sort: 3,
  });

  const zodiac = "Zodiac stones";
  const vedic = "Vedic favourites";
  const exclusive = "Rare colours";
  const other = "Further stones";
  const special = "Special cuts";

  const cat = {
    "yellow-sapphire": category({ parentId: gems, slug: "yellow-sapphire", name: "Yellow Sapphire", kind: "gemstone", group: zodiac, sort: 1 }),
    "blue-sapphire": category({ parentId: gems, slug: "blue-sapphire", name: "Blue Sapphire", kind: "gemstone", group: zodiac, sort: 2 }),
    emerald: category({ parentId: gems, slug: "emerald", name: "Emerald", kind: "gemstone", group: zodiac, sort: 3 }),
    ruby: category({ parentId: gems, slug: "ruby", name: "Ruby", kind: "gemstone", group: zodiac, sort: 4 }),
    pearl: category({ parentId: gems, slug: "pearl", name: "Pearl", kind: "gemstone", group: zodiac, sort: 5 }),
    "red-coral": category({ parentId: gems, slug: "red-coral", name: "Red Coral", kind: "gemstone", group: zodiac, sort: 6 }),
    hessonite: category({ parentId: gems, slug: "hessonite", name: "Hessonite", kind: "gemstone", group: zodiac, sort: 7 }),
    "cats-eye": category({ parentId: gems, slug: "cats-eye", name: "Cat's Eye", kind: "gemstone", group: zodiac, sort: 8 }),
    "white-sapphire": category({ parentId: gems, slug: "white-sapphire", name: "White Sapphire", kind: "gemstone", group: zodiac, sort: 9 }),
    amethyst: category({ parentId: gems, slug: "amethyst", name: "Amethyst", kind: "gemstone", group: vedic, sort: 10 }),
    opal: category({ parentId: gems, slug: "opal", name: "Opal", kind: "gemstone", group: vedic, sort: 11 }),
    garnet: category({ parentId: gems, slug: "garnet", name: "Garnet", kind: "gemstone", group: vedic, sort: 12 }),
    peridot: category({ parentId: gems, slug: "peridot", name: "Peridot", kind: "gemstone", group: vedic, sort: 13 }),
    turquoise: category({ parentId: gems, slug: "turquoise", name: "Turquoise", kind: "gemstone", group: vedic, sort: 14 }),
    navratna: category({ parentId: gems, slug: "navratna", name: "Navratna", kind: "gemstone", group: vedic, sort: 15 }),
    alexandrite: category({ parentId: gems, slug: "alexandrite", name: "Alexandrite", kind: "gemstone", group: exclusive, sort: 16 }),
    tanzanite: category({ parentId: gems, slug: "tanzanite", name: "Tanzanite", kind: "gemstone", group: exclusive, sort: 17 }),
    padparadscha: category({ parentId: gems, slug: "padparadscha", name: "Padparadscha Sapphire", kind: "gemstone", group: exclusive, sort: 18 }),
    aquamarine: category({ parentId: gems, slug: "aquamarine", name: "Aquamarine", kind: "gemstone", group: other, sort: 19 }),
    moonstone: category({ parentId: gems, slug: "moonstone", name: "Moonstone", kind: "gemstone", group: other, sort: 20 }),
    pairs: category({ parentId: gems, slug: "matched-pairs", name: "Matched Pairs", kind: "gemstone", group: special, sort: 21 }),
    rings: category({ parentId: jewellery, slug: "rings", name: "Rings", kind: "jewellery", group: "By type", sort: 1 }),
    pendants: category({ parentId: jewellery, slug: "pendants", name: "Pendants", kind: "jewellery", group: "By type", sort: 2 }),
    bracelets: category({ parentId: jewellery, slug: "bracelets", name: "Bracelets", kind: "jewellery", group: "By type", sort: 3 }),
    earrings: category({ parentId: jewellery, slug: "earrings", name: "Earrings", kind: "jewellery", group: "By type", sort: 4 }),
    engagement: category({ parentId: jewellery, slug: "engagement-rings", name: "Engagement Rings", kind: "jewellery", group: "Bridal", sort: 5 }),
    colPairs: category({ parentId: collections, slug: "gemstone-pairs", name: "Gemstone Pairs", kind: "collection", sort: 1 }),
    colBridal: category({ parentId: collections, slug: "bridal-edit", name: "Bridal Edit", kind: "collection", sort: 2 }),
    colCuff: category({ parentId: collections, slug: "temple-cuff", name: "Temple Cuff", kind: "collection", sort: 3 }),
    colBrooch: category({ parentId: collections, slug: "brooches", name: "Brooches", kind: "collection", sort: 4 }),
  };

  const loose = (row) => product({ kind: "loose", stock: 3, ...row });

  loose({
    sku: "VG-YS-032",
    slug: "ceylon-yellow-sapphire-3-2ct",
    name: "Ceylon Yellow Sapphire",
    categoryId: cat["yellow-sapphire"],
    summary: "Warm golden cushion, 3.20 carats.",
    description: "A heated Ceylon yellow sapphire with an even golden body colour. Supplied with a lab dossier and a cotton pouch.",
    benefit: "Chosen by clients asking for prosperity and a settled household.",
    carat: 3.2, shape: "Cushion", origin: "Sri Lanka", treatment: "Heated", certification: "GIA",
    priceCents: 186000, swatch: "#e2b340", featured: true, purpose: "wealth", sort: 1,
  });
  loose({
    sku: "VG-BS-024",
    slug: "cornflower-blue-sapphire-2-4ct",
    name: "Cornflower Blue Sapphire",
    categoryId: cat["blue-sapphire"],
    summary: "Clear cornflower oval, 2.40 carats.",
    description: "Heated blue sapphire from Sri Lanka. The colour stays even in daylight and warm indoor light.",
    benefit: "Often requested for focus, discipline, and a steadier career path.",
    carat: 2.4, shape: "Oval", origin: "Sri Lanka", treatment: "Heated", certification: "GRS",
    priceCents: 242000, swatch: "#2f5fbf", featured: true, purpose: "career", sort: 2,
  });
  loose({
    sku: "VG-EM-018",
    slug: "zambia-emerald-1-8ct",
    name: "Zambian Emerald",
    categoryId: cat.emerald,
    summary: "Vivid green oval with minor oil, 1.80 carats.",
    description: "A minor-oil emerald. The garden is visible and the green reads clearly across the table.",
    benefit: "Associated in our guides with speech, study, and trade.",
    carat: 1.8, shape: "Oval", origin: "Zambia", treatment: "Minor oil", certification: "GIA",
    priceCents: 164000, swatch: "#1f8a4c", featured: true, purpose: "education", sort: 3,
  });
  loose({
    sku: "VG-RB-021",
    slug: "mozambique-ruby-2-1ct",
    name: "Mozambique Ruby",
    categoryId: cat.ruby,
    summary: "Pigeon-red oval, 2.10 carats.",
    description: "Heated ruby with a saturated red and no obvious window. Ready to set in gold.",
    benefit: "Clients ask for ruby when they want vitality and a stronger public presence.",
    carat: 2.1, shape: "Oval", origin: "Mozambique", treatment: "Heated", certification: "GRS",
    priceCents: 198000, swatch: "#b42334", featured: true, purpose: "health", sort: 4,
  });
  loose({
    sku: "VG-PL-070",
    slug: "freshwater-pearl-7mm",
    name: "Freshwater Pearl",
    categoryId: cat.pearl,
    summary: "Cream button pearl, 7.0 mm.",
    description: "A smooth cream pearl with a soft orient. Drilled on request when you order a pendant or ring.",
    benefit: "Paired in our guides with calm, care of family, and emotional balance.",
    carat: 2.6, shape: "Button", origin: "China", treatment: "Untreated", certification: "In-house",
    priceCents: 18000, swatch: "#f3ead7", featured: true, purpose: "relationships", sort: 5,
  });
  loose({
    sku: "VG-RC-055",
    slug: "italian-red-coral-5-5ct",
    name: "Italian Red Coral",
    categoryId: cat["red-coral"],
    summary: "Deep red cabochon, 5.50 carats.",
    description: "Natural red coral, polished as a high cabochon. Colour is uniform from rim to rim.",
    benefit: "Requested for courage and to steady a restless schedule.",
    carat: 5.5, shape: "Cabochon", origin: "Italy", treatment: "Untreated", certification: "IGI",
    priceCents: 42000, swatch: "#d24a3a", purpose: "health", sort: 6,
  });
  loose({
    sku: "VG-HS-045",
    slug: "honey-hessonite-4-5ct",
    name: "Honey Hessonite",
    categoryId: cat.hessonite,
    summary: "Honey oval with internal silk, 4.50 carats.",
    description: "A transparent honey hessonite. The colour is warm rather than brown.",
    benefit: "Used in our purpose guide when a client asks for composure and recognition.",
    carat: 4.5, shape: "Oval", origin: "Sri Lanka", treatment: "Untreated", certification: "In-house",
    priceCents: 36000, swatch: "#c47a3a", purpose: "career", sort: 7,
  });
  loose({
    sku: "VG-CE-031",
    slug: "chrysoberyl-cats-eye-3-1ct",
    name: "Chrysoberyl Cat's Eye",
    categoryId: cat["cats-eye"],
    summary: "Sharp milk-and-honey ray, 3.10 carats.",
    description: "The chatoyant band stays centred when the stone is rocked. Cabochon cut for a ring or pendant.",
    benefit: "Kept for clients who want protection and a clear line of sight in decisions.",
    carat: 3.1, shape: "Cabochon", origin: "India", treatment: "Untreated", certification: "GRS",
    priceCents: 88000, swatch: "#d8c07a", sort: 8,
  });
  loose({
    sku: "VG-WS-026",
    slug: "white-sapphire-2-6ct",
    name: "White Sapphire",
    categoryId: cat["white-sapphire"],
    summary: "Bright round brilliant, 2.60 carats.",
    description: "A near-colourless heated white sapphire. A practical choice when a client wants the Venus stone in daily wear.",
    benefit: "Mapped to partnerships, art, and comfort in our recommendation rules.",
    carat: 2.6, shape: "Round", origin: "Sri Lanka", treatment: "Heated", certification: "GIA",
    priceCents: 54000, swatch: "#f7f7f2", purpose: "relationships", sort: 9,
  });
  loose({
    sku: "VG-AM-060",
    slug: "amethyst-cushion-6ct",
    name: "Deep Amethyst",
    categoryId: cat.amethyst,
    summary: "Royal purple cushion, 6.00 carats.",
    description: "Even purple with no zoning across the crown. Suitable for a statement ring.",
    benefit: "A quieter stone clients choose for rest and study.",
    carat: 6, shape: "Cushion", origin: "Brazil", treatment: "Heated", certification: "In-house",
    priceCents: 22000, swatch: "#6d4ea3", purpose: "education", sort: 10,
  });
  loose({
    sku: "VG-OP-034",
    slug: "ethiopian-opal-3-4ct",
    name: "Ethiopian Opal",
    categoryId: cat.opal,
    summary: "Play-of-colour oval, 3.40 carats.",
    description: "A hydrophane opal with flashes of orange and green. We include care notes with every opal order.",
    benefit: "Chosen for charm, ease with people, and a lighter mood.",
    carat: 3.4, shape: "Oval", origin: "Ethiopia", treatment: "Untreated", certification: "In-house",
    priceCents: 28000, swatch: "#f08a3c", featured: true, purpose: "relationships", sort: 11,
  });
  loose({
    sku: "VG-NV-009",
    slug: "navratna-nine-stone-layout",
    name: "Navratna Layout",
    categoryId: cat.navratna,
    summary: "Nine small stones, matched for a pendant or ring.",
    description: "Ruby, pearl, coral, emerald, yellow sapphire, diamond substitute white sapphire, blue sapphire, hessonite, and cat's eye, laid out for a single setting.",
    benefit: "A balanced set when a client wants every classical stone represented.",
    carat: 4.5, shape: "Mixed", origin: "Mixed", treatment: "Mixed", certification: "In-house",
    priceCents: 96000, swatch: "#8c3a4a", featured: true, sort: 12,
  });
  loose({
    sku: "VG-TZ-040",
    slug: "tanzanite-oval-4ct",
    name: "Tanzanite Oval",
    categoryId: cat.tanzanite,
    summary: "Blue-violet oval, 4.00 carats.",
    description: "Heated tanzanite, the usual trade state for this gem. Colour shifts between blue and violet.",
    benefit: "A modern stone clients pair with communication and new work.",
    carat: 4, shape: "Oval", origin: "Tanzania", treatment: "Heated", certification: "GIA",
    priceCents: 112000, swatch: "#3d4fbf", purpose: "career", sort: 13,
  });
  loose({
    sku: "VG-AQ-050",
    slug: "aquamarine-emerald-cut-5ct",
    name: "Aquamarine",
    categoryId: cat.aquamarine,
    summary: "Sea-blue emerald cut, 5.00 carats.",
    description: "Clean aquamarine with a calm blue. The step cut keeps the colour even.",
    benefit: "A gentle stone for clarity and long travel.",
    carat: 5, shape: "Emerald", origin: "Madagascar", treatment: "Heated", certification: "IGI",
    priceCents: 46000, swatch: "#7ec8d4", purpose: "education", sort: 14,
  });

  loose({
    sku: "VG-PP-012",
    slug: "emerald-matched-pair-2-7ct",
    name: "Emerald Matched Pair",
    categoryId: cat.pairs,
    collectionId: cat.colPairs,
    summary: "Two minor-oil ovals, 2.70 carats together.",
    description: "A matched pair for earrings. Colour and outline were selected side by side.",
    benefit: "Suitable when the recommendation is emerald and the client wants a pair.",
    carat: 2.7, shape: "Oval", origin: "Zambia", treatment: "Minor oil", certification: "GIA",
    priceCents: 210000, swatch: "#147a45", sort: 15,
  });

  product({
    sku: "VG-RG-YS-01",
    slug: "yellow-sapphire-gold-ring",
    name: "Yellow Sapphire Gold Ring",
    categoryId: cat.rings,
    kind: "jewellery",
    summary: "2.10 carat yellow sapphire in 18k yellow gold.",
    description: "A low bezel with milgrain. The sapphire is heated Ceylon material, set in our Bengaluru bench.",
    benefit: "A daily ring for the Jupiter stone.",
    carat: 2.1, shape: "Cushion", origin: "Sri Lanka", treatment: "Heated", certification: "GIA",
    metal: "Gold", jewelleryType: "Ring", birthMonth: 11,
    priceCents: 156000, stock: 4, swatch: "#e2b340", bestseller: true, purpose: "wealth", sort: 1,
  });
  product({
    sku: "VG-PD-BS-01",
    slug: "blue-sapphire-pendant",
    name: "Blue Sapphire Pendant",
    categoryId: cat.pendants,
    kind: "jewellery",
    summary: "1.60 carat oval on a gold bail.",
    description: "The pendant sits close to the throat. Chain is sold separately in 16 or 18 inch.",
    benefit: "A simple way to wear the Saturn stone.",
    carat: 1.6, shape: "Oval", origin: "Sri Lanka", treatment: "Heated", certification: "GRS",
    metal: "Gold", jewelleryType: "Pendant", birthMonth: 9,
    priceCents: 128000, stock: 5, swatch: "#2f5fbf", bestseller: true, purpose: "career", sort: 2,
  });
  product({
    sku: "VG-RG-EM-01",
    slug: "emerald-everyday-ring",
    name: "Emerald Everyday Ring",
    categoryId: cat.rings,
    kind: "jewellery",
    summary: "1.20 carat emerald in a slim gold band.",
    description: "Minor-oil emerald, four grains, made to sit under a glove.",
    benefit: "For study, trade, and a lighter hand.",
    carat: 1.2, shape: "Oval", origin: "Zambia", treatment: "Minor oil", certification: "GIA",
    metal: "Gold", jewelleryType: "Ring", birthMonth: 5,
    priceCents: 98000, stock: 4, swatch: "#1f8a4c", bestseller: true, purpose: "education", sort: 3,
  });
  product({
    sku: "VG-BR-PL-01",
    slug: "pearl-line-bracelet",
    name: "Pearl Line Bracelet",
    categoryId: cat.bracelets,
    kind: "jewellery",
    summary: "Seven cream pearls on gold wire.",
    description: "Freshwater pearls, knotted between, with a gold box clasp.",
    benefit: "A soft piece for the Moon stone.",
    shape: "Button", origin: "China", treatment: "Untreated", certification: "In-house",
    metal: "Gold", jewelleryType: "Bracelet", birthMonth: 6,
    priceCents: 64000, stock: 6, swatch: "#f3ead7", bestseller: true, purpose: "relationships", sort: 4,
  });
  product({
    sku: "VG-ER-RB-01",
    slug: "ruby-engagement-ring",
    name: "Ruby Engagement Ring",
    categoryId: cat.engagement,
    collectionId: cat.colBridal,
    kind: "jewellery",
    summary: "1.50 carat ruby with a tapered gold shoulder.",
    description: "Heated Mozambique ruby. The setting can be resized by two sizes after delivery.",
    benefit: "A bridal ruby for vitality and a public promise.",
    carat: 1.5, shape: "Oval", origin: "Mozambique", treatment: "Heated", certification: "GRS",
    metal: "Gold", jewelleryType: "Engagement Ring", birthMonth: 7,
    priceCents: 214000, stock: 2, swatch: "#b42334", purpose: "relationships", sort: 5,
  });
  product({
    sku: "VG-PD-RC-01",
    slug: "red-coral-silver-pendant",
    name: "Red Coral Pendant",
    categoryId: cat.pendants,
    kind: "jewellery",
    summary: "Cabochon coral in polished silver.",
    description: "Italian coral on an adjustable silver chain. A lighter metal for daily wear.",
    benefit: "A direct way to wear coral for steadiness.",
    carat: 4.2, shape: "Cabochon", origin: "Italy", treatment: "Untreated", certification: "IGI",
    metal: "Silver", jewelleryType: "Pendant", birthMonth: 3,
    priceCents: 24000, stock: 8, swatch: "#d24a3a", purpose: "health", sort: 6,
  });
  product({
    sku: "VG-CF-01",
    slug: "temple-gold-cuff",
    name: "Temple Gold Cuff",
    categoryId: cat.bracelets,
    collectionId: cat.colCuff,
    kind: "jewellery",
    summary: "Open cuff with a small navratna centre.",
    description: "22k gold-plated silver structure with a nine-stone cluster. Made as a signature bracelet, not a costume copy.",
    benefit: "A single piece when a client wants the full set of stones on the wrist.",
    carat: 1.8, shape: "Mixed", origin: "Mixed", treatment: "Mixed", certification: "In-house",
    metal: "Panchdhatu", jewelleryType: "Bracelet",
    priceCents: 72000, stock: 3, swatch: "#c4a574", bestseller: true, sort: 7,
  });
  product({
    sku: "VG-BRC-01",
    slug: "emerald-brooch",
    name: "Emerald Leaf Brooch",
    categoryId: cat.earrings,
    collectionId: cat.colBrooch,
    kind: "jewellery",
    summary: "Carved leaf in silver with an emerald centre.",
    description: "A small brooch that can also be worn as a saree pin. The emerald is a 0.80 carat oval.",
    benefit: "Ornament first, with the Mercury stone at the centre.",
    carat: 0.8, shape: "Oval", origin: "Zambia", treatment: "Minor oil", certification: "In-house",
    metal: "Silver", jewelleryType: "Brooch",
    priceCents: 38000, stock: 2, swatch: "#1f8a4c", sort: 8,
  });

  loose({
    sku: "VG-V-BS-01",
    slug: "vault-royal-blue-sapphire",
    name: "Royal Blue Sapphire",
    categoryId: cat["blue-sapphire"],
    summary: "Unheated royal blue, held in the vault.",
    description: "A rare unheated blue offered by appointment. Weight, origin papers, and price are shared on a call.",
    benefit: "For a client who wants an unheated stone and is ready to speak with the desk.",
    carat: 3.8, shape: "Cushion", origin: "Sri Lanka", treatment: "Unheated", certification: "Gubelin",
    callForPrice: true, stock: 1, swatch: "#1d3f8f", vault: true, purpose: "career", sort: 30,
  });
  loose({
    sku: "VG-V-AX-01",
    slug: "vault-russian-alexandrite",
    name: "Russian Alexandrite",
    categoryId: cat.alexandrite,
    summary: "Colour-change oval held in the vault.",
    description: "The stone shifts from green in daylight to raspberry in warm light. Price is given by the vault desk.",
    benefit: "A collector stone, not part of the open price list.",
    carat: 2.14, shape: "Oval", origin: "Russia", treatment: "Untreated", certification: "GRS",
    callForPrice: true, stock: 1, swatch: "#2f6b4f", vault: true, sort: 31,
  });
  loose({
    sku: "VG-V-PD-01",
    slug: "vault-padparadscha",
    name: "Padparadscha Sapphire",
    categoryId: cat.padparadscha,
    summary: "Lotus-coloured sapphire, call for price.",
    description: "A pink-orange sapphire with papers. Viewings are arranged from the Jaipur bench.",
    benefit: "Held for clients who want a rare sapphire outside the usual blue and yellow.",
    carat: 2.05, shape: "Oval", origin: "Sri Lanka", treatment: "Unheated", certification: "GRS",
    callForPrice: true, stock: 1, swatch: "#e48b7a", vault: true, sort: 32,
  });

  loose({
    sku: "VG-LS-RB-01",
    slug: "limited-ruby-3ct",
    name: "Limited Ruby Oval",
    categoryId: cat.ruby,
    summary: "3.00 carat heated ruby, this week only.",
    description: "A deeper ruby from the open stock, marked down while the limited desk is open. The certificate travels with the stone.",
    benefit: "The same health stone, at a shorter price window.",
    carat: 3, shape: "Oval", origin: "Mozambique", treatment: "Heated", certification: "GRS",
    priceCents: 129000, compareCents: 168000, stock: 1, swatch: "#9c1c2c", limited: true, purpose: "health", sort: 40,
  });
  product({
    sku: "VG-LS-PD-01",
    slug: "limited-garnet-ring",
    name: "Limited Garnet Ring",
    categoryId: cat.rings,
    kind: "jewellery",
    summary: "Rhodolite garnet in silver, reduced this week.",
    description: "A finished ring from the bench. One size in stock, listed until it sells.",
    benefit: "An approachable red for clients who are not ready for ruby.",
    carat: 2.4, shape: "Oval", origin: "India", treatment: "Untreated", certification: "In-house",
    metal: "Silver", jewelleryType: "Ring", birthMonth: 1,
    priceCents: 9000, compareCents: 14000, stock: 1, swatch: "#8e2448", limited: true, sort: 41,
  });

  const banners = [
    ["home", "Stones with a reason", "Loose gems and jewellery, priced in the currency you choose.", "Find a stone", "shop:gemstones", "#6b1d2a", 1],
    ["home", "The vault is open", "Unheated and rare stones. Ask the desk for the price.", "View the vault", "shop:vault", "#1d3f8f", 2],
    ["home", "A stone for this season", "Limited pieces leave the list when they sell.", "See specials", "shop:limited", "#9c1c2c", 3],
  ];
  for (const [placement, title, subtitle, cta, target, swatch, sort] of banners) {
    run(
      `INSERT INTO banners (placement, title, subtitle, cta_label, cta_target, swatch, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      placement, title, subtitle, cta, target, swatch, sort,
    );
  }

  const blocks = [
    ["home_intro", "home", "Find the stone that fits the life you are building", "Search by gem, by purpose, or send your birth details to the desk.", "", "", 1],
    ["certified", "home", "Lab papers, not just a story", "Every priced stone on this list names its treatment and the lab, or says clearly that the note is in-house.", "Shop certified", "shop:gemstones", 2],
    ["energize", "home", "Optional energizing", "If you want the stone recited over before it ships, add a note at checkout or send an enquiry. The bench in Jaipur handles it.", "Ask the desk", "enquire:expert", 3],
    ["custom_intro", "custom", "Your drawing, our bench", "Bring a family piece, a sketch, or only a sentence. We reply with a drawing before any metal is cut.", "Book a session", "enquire:custom_design", 1],
    ["step-1", "custom_steps", "Share the idea", "A photo, a rashi, or a sentence about who will wear it.", "", "", 1],
    ["step-2", "custom_steps", "See the sketch", "The designer sends a line drawing and a metal quote.", "", "", 2],
    ["step-3", "custom_steps", "Approve the form", "You confirm stone, metal, and size before work starts.", "", "", 3],
    ["step-4", "custom_steps", "Receive the piece", "It ships with papers, a box, and a care note.", "", "", 4],
    ["trust", "home", "A desk that answers", "Sales is open through the week. Support answers from 9:30am to 9:30pm IST.", "", "", 5],
  ];
  for (const [key, group, title, body, cta, target, sort] of blocks) {
    run(
      `INSERT INTO content_blocks (block_key, group_name, title, body, cta_label, cta_target, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      key, group, title, body, cta, target, sort,
    );
  }

  const reviews = [
    ["Anita Deshpande", 5, "The ring matched the photo", "The yellow sapphire ring arrived with the certificate in the same box. The colour in daylight is the colour I approved."],
    ["Rahul Menon", 5, "Clear about treatment", "I asked twice whether the blue sapphire was heated. The listing and the counsellor said the same thing."],
    ["Farah Qureshi", 4, "Pearl bracelet, quietly made", "The pearls are even and the clasp feels solid. Shipping to Hyderabad took four days."],
    ["Joseph Mathew", 5, "Vault call was useful", "I did not buy the alexandrite, but the desk explained the colour change without pushing."],
  ];
  for (const [author, rating, title, body] of reviews) {
    run(
      `INSERT INTO reviews (author, rating, title, body, published) VALUES (?, ?, ?, ?, 1)`,
      author, rating, title, body,
    );
  }

  run(
    `INSERT INTO blog_posts (slug, title, excerpt, body, published) VALUES (?, ?, ?, ?, 1)`,
    "how-we-name-a-stone",
    "How we name a stone before you buy it",
    "Origin, treatment, and weight are on the listing because they change the price and the way you wear it.",
    "A listing at Vijayalakshmi Gems always states the gem, the weight, the shape, where it was mined, and what was done to it after mining. Heated does not mean fake. Oiled does not mean glass. If a paper is in-house, we say so.\n\nIf you are buying for a purpose, start with the recommendation desk. The open guide uses the rashi windows and purpose map configured in the portal. A person still confirms the stone before you wear a strong one such as blue sapphire.",
  );
  run(
    `INSERT INTO blog_posts (slug, title, excerpt, body, published) VALUES (?, ?, ?, ?, 1)`,
    "wearing-weight-and-carat",
    "Why we ask for body weight",
    "The suggested carat is a starting point from your weight, not a medical dose.",
    "The recommendation form asks for body weight because the atelier uses a simple rule: suggested carat equals weight in kilograms divided by a number the portal can change. The default divisor is 12, so a person of 60 kilograms is shown a 5 carat guide.\n\nThat number is a shopping guide. Skin, budget, and the stone itself decide what you actually wear. Coral and pearl are often chosen lighter. A vault stone is chosen by the desk, not by this sum.",
  );

  const purposes = [
    ["health", "General health", "Sun", "Ruby", "Vitality and a steadier body.", 1],
    ["career", "Career", "Saturn", "Blue Sapphire", "Discipline and a longer view of work.", 2],
    ["wealth", "Wealth and fortune", "Jupiter", "Yellow Sapphire", "Growth, teachers, and a fuller household.", 3],
    ["education", "Education", "Mercury", "Emerald", "Study, speech, and trade.", 4],
    ["relationships", "Relationships", "Venus", "White Sapphire", "Partnership, ease, and care.", 5],
  ];
  for (const [slug, name, planet, gemstone, blurb, sort] of purposes) {
    run(
      `INSERT INTO purposes (slug, name, planet, gemstone, blurb, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      slug, name, planet, gemstone, blurb, sort,
    );
  }

  const rashis = [
    ["Mesha", "Aries", "Mars", "Red Coral", 4, 14, 5, 14, 1],
    ["Vrishabha", "Taurus", "Venus", "White Sapphire", 5, 15, 6, 14, 2],
    ["Mithuna", "Gemini", "Mercury", "Emerald", 6, 15, 7, 14, 3],
    ["Karka", "Cancer", "Moon", "Pearl", 7, 15, 8, 14, 4],
    ["Simha", "Leo", "Sun", "Ruby", 8, 15, 9, 15, 5],
    ["Kanya", "Virgo", "Mercury", "Emerald", 9, 16, 10, 15, 6],
    ["Tula", "Libra", "Venus", "White Sapphire", 10, 16, 11, 14, 7],
    ["Vrischika", "Scorpio", "Mars", "Red Coral", 11, 15, 12, 14, 8],
    ["Dhanu", "Sagittarius", "Jupiter", "Yellow Sapphire", 12, 15, 1, 13, 9],
    ["Makara", "Capricorn", "Saturn", "Blue Sapphire", 1, 14, 2, 11, 10],
    ["Kumbha", "Aquarius", "Saturn", "Blue Sapphire", 2, 12, 3, 13, 11],
    ["Meena", "Pisces", "Jupiter", "Yellow Sapphire", 3, 14, 4, 13, 12],
  ];
  for (const [name, english, lord, gemstone, sm, sd, em, ed, sort] of rashis) {
    run(
      `INSERT INTO rashis (name, english_name, lord, gemstone, start_month, start_day, end_month, end_day, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name,
      english,
      lord,
      gemstone,
      sm,
      sd,
      em,
      ed,
      "Date window used when a full chart is not cast. Edit the dates in the portal if the atelier prefers another calendar.",
      sort,
    );
  }

  const currencies = [
    ["USD", "US Dollar", "$", 1, 1, 1],
    ["INR", "Indian Rupee", "₹", 83.5, 0, 2],
    ["GBP", "British Pound", "£", 0.78, 0, 3],
    ["EUR", "Euro", "€", 0.92, 0, 4],
    ["AED", "UAE Dirham", "AED ", 3.67, 0, 5],
  ];
  for (const [code, name, symbol, rate, isDefault, sort] of currencies) {
    run(
      `INSERT INTO currencies (code, name, symbol, rate, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      code, name, symbol, rate, isDefault, sort,
    );
  }

  const filters = [
    ["carat", "Under 3 carat", 0, 3, null, 1],
    ["carat", "3 – 5 carat", 3, 5, null, 2],
    ["carat", "5 – 7 carat", 5, 7, null, 3],
    ["carat", "7 carat and above", 7, null, null, 4],
    ["price", "Under $500", 0, 500, null, 1],
    ["price", "$500 – $1,000", 500, 1000, null, 2],
    ["price", "$1,000 – $2,000", 1000, 2000, null, 3],
    ["price", "$2,000 and above", 2000, null, null, 4],
    ["treatment", "Heated", null, null, "Heated", 1],
    ["treatment", "Unheated", null, null, "Unheated", 2],
    ["treatment", "Minor oil", null, null, "Minor oil", 3],
    ["treatment", "Untreated", null, null, "Untreated", 4],
    ["origin", "Sri Lanka", null, null, "Sri Lanka", 1],
    ["origin", "Mozambique", null, null, "Mozambique", 2],
    ["origin", "Zambia", null, null, "Zambia", 3],
    ["origin", "India", null, null, "India", 4],
    ["shape", "Oval", null, null, "Oval", 1],
    ["shape", "Cushion", null, null, "Cushion", 2],
    ["shape", "Round", null, null, "Round", 3],
    ["shape", "Cabochon", null, null, "Cabochon", 4],
    ["metal", "Gold", null, null, "Gold", 1],
    ["metal", "Silver", null, null, "Silver", 2],
    ["metal", "Panchdhatu", null, null, "Panchdhatu", 3],
    ["certification", "GIA", null, null, "GIA", 1],
    ["certification", "GRS", null, null, "GRS", 2],
    ["certification", "IGI", null, null, "IGI", 3],
    ["certification", "Gubelin", null, null, "Gubelin", 4],
  ];
  for (const [key, label, min, max, match, sort] of filters) {
    run(
      `INSERT INTO filter_options (filter_key, label, min_value, max_value, match_value, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      key, label, min, max, match, sort,
    );
  }

  const pages = [
    ["shipping", "Shipping", "Orders leave Bengaluru or Jaipur within two working days after payment. India delivery is usually three to six days. Overseas parcels are sent with a tracking number and may meet customs duty, which the receiver pays.", 1],
    ["returns", "Returns and exchange", "Loose stones can be returned within ten days if the paper and the pouch are intact and the stone is unset. Jewellery that was resized or engraved is exchanged only for a making fault.", 2],
    ["payment", "Payment", "The app takes a card-style checkout in this demo build. A paid deployment can attach a payment provider without changing the catalog, because prices always come from the server.", 3],
    ["ring-size", "Ring size", "Measure a ring that already fits, in millimetres, across the inside. Send that number with the order note. We confirm before the bench sizes a gold ring.", 4],
    ["faq", "Questions", "Heated stones are natural stones that were warmed to improve colour. Call-for-price pieces are real stock held in the vault. The recommendation guide is configurable and is confirmed by the desk before a strong stone is worn.", 5],
    ["privacy", "Privacy", "Account details, birth details, and enquiries stay in this application's database. The configuration portal is the only place staff should edit them.", 6],
  ];
  for (const [slug, title, body, sort] of pages) {
    run(
      `INSERT INTO pages (slug, title, body, sort_order) VALUES (?, ?, ?, ?)`,
      slug, title, body, sort,
    );
  }

  setSetting("brand", "Vijayalakshmi Gems");
  setSetting("tagline", "Loose gemstones and jewellery, chosen with the reason written beside them.");
  setSetting("company", "Vijayalakshmi Gems Atelier");
  setSetting("sales_hours", "Sales: all week, 8:00am – 9:00pm IST");
  setSetting("support_hours", "Support: 9:30am – 9:30pm IST");
  setSetting("carat_divisor", 12);
  setSetting(
    "recommendation_disclaimer",
    "This guide uses the rashi windows and purpose stones saved in the configuration portal. It is a starting point. The desk confirms a strong stone before you wear it.",
  );
  setSetting("phones", [
    { label: "India", value: "+91 80 0000 1001" },
    { label: "Desk", value: "+91 141 000 1001" },
  ]);
  setSetting("locations", [
    { city: "Bengaluru", lines: "Vijayalakshmi Gems, 18 Residency Road, Bengaluru 560025" },
    { city: "Jaipur", lines: "Cutting bench, Johari Bazaar lane, Jaipur 302003" },
  ]);

  const ruby = one("SELECT id, price_cents FROM products WHERE slug = ?", "mozambique-ruby-2-1ct");
  const orderId = run(
    `INSERT INTO orders (user_id, status, currency, subtotal_cents, ship_name, ship_phone, ship_line1, ship_city, ship_country)
     VALUES (?, 'confirmed', 'INR', ?, ?, ?, ?, ?, ?)`,
    customerId,
    ruby.price_cents,
    "Meera Rao",
    "+91 80 0000 1002",
    "12 Lake View, Indiranagar",
    "Bengaluru",
    "India",
  ).id;
  run(
    `INSERT INTO order_items (order_id, product_id, name, sku, qty, unit_cents) VALUES (?, ?, ?, ?, 1, ?)`,
    orderId,
    ruby.id,
    "Mozambique Ruby",
    "VG-RB-021",
    ruby.price_cents,
  );

  run(
    `INSERT INTO enquiries (type, name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?)`,
    "astrologer",
    "Meera Rao",
    "+91 80 0000 1002",
    "meera@vijayalakshmi.local",
    "Please call about a stone for career. Birth details are in the recommendation list.",
    "new",
  );

  many("SELECT id FROM products");
}
