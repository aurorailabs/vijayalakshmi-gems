import cors from "cors";
import express from "express";
import {
  attachUser,
  checkPassword,
  clearAttempts,
  hashPassword,
  isEmail,
  isPhone,
  normalizeEmail,
  phoneKey,
  publicUser,
  recordAttempt,
  registrationError,
  requireUser,
  signUser,
  tooManyAttempts,
} from "./auth.js";
import { db, getSettings, many, one, run, setSetting } from "./db.js";
import {
  ASSIGNABLE_FEATURES,
  ASSIGNABLE_MENUS,
  allows,
  cleanFeatures,
  cleanMenus,
  deskProfile,
  isSuper,
  kindAllowed,
  shopOwnsCoupon,
  shopOwnsEnquiry,
  shopOwnsOrder,
  shopOwnsReview,
} from "./desk.js";
import { PAYMENTS, SHIPPING, paymentMethod, quoteTotals, shippingMethod, taxPercent } from "./commerce.js";
import { buildRecommendation } from "./recommend.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(attachUser);

function desk(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Sign in required" });
  const user = one("SELECT * FROM users WHERE id = ?", req.user.id);
  if (!user || !["superadmin", "shop"].includes(user.role)) {
    return res.status(403).json({ error: "Desk access required" });
  }
  const roleRow = user.role_id ? one("SELECT * FROM roles WHERE id = ?", user.role_id) : null;
  req.desk = { ...deskProfile(user, roleRow), user };
  next();
}

function accountView(user) {
  const view = publicUser(user);
  if (user.role !== "superadmin" && user.role !== "shop") return view;
  const shop = user.shop_id ? one("SELECT name, city, slug FROM shops WHERE id = ?", user.shop_id) : null;
  const roleRow = user.role_id ? one("SELECT * FROM roles WHERE id = ?", user.role_id) : null;
  return { ...view, ...deskProfile(user, roleRow), shopName: shop?.name || "", shopCity: shop?.city || "" };
}

function gate(req, res, menu, { superOnly = false } = {}) {
  if (superOnly && !isSuper(req.desk)) {
    res.status(403).json({ error: "Only the super admin can do this." });
    return false;
  }
  if (!superOnly && !allows(req.desk, menu)) {
    res.status(403).json({ error: "This menu is not assigned to your shop." });
    return false;
  }
  return true;
}

const SUPER_TABLES = new Set(["categories", "banners", "content_blocks", "blog_posts", "purposes", "rashis", "filter_options", "pages", "currencies", "recommendations"]);
const SHOP_TABLES = { orders: "orders", enquiries: "enquiries", reviews: "reviews", coupons: "coupons", customers: "customers" };

function gateTable(req, res, table) {
  if (SHOP_TABLES[table]) return gate(req, res, SHOP_TABLES[table]);
  if (SUPER_TABLES.has(table)) return gate(req, res, table, { superOnly: true });
  return gate(req, res, table, { superOnly: true });
}

function assertShopRow(req, res) {
  if (req.desk.role !== "shop") return true;
  const id = Number(req.params.id);
  const table = req.params.table;
  const ok = table === "orders" ? shopOwnsOrder(req.desk.shopId, id)
    : table === "enquiries" ? shopOwnsEnquiry(req.desk.shopId, id)
    : table === "reviews" ? shopOwnsReview(req.desk.shopId, id)
    : table === "coupons" ? shopOwnsCoupon(req.desk.shopId, id)
    : false;
  if (!ok) {
    res.status(404).json({ error: "Not found." });
    return false;
  }
  return true;
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function currencyFrom(req) {
  const code = String(req.query.currency || req.headers["x-currency"] || "").toUpperCase();
  if (code) {
    const row = one("SELECT * FROM currencies WHERE code = ? AND active = 1", code);
    if (row) return row;
  }
  return one("SELECT * FROM currencies WHERE is_default = 1 AND active = 1") || {
    code: "USD",
    symbol: "$",
    rate: 1,
    name: "US Dollar",
  };
}

function money(cents, currency) {
  if (cents == null) return null;
  return Math.round((cents / 100) * currency.rate * 100) / 100;
}

function presentProduct(row, currency) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    summary: row.summary || "",
    description: row.description || "",
    benefit: row.benefit || "",
    carat: row.carat,
    shape: row.shape || "",
    origin: row.origin || "",
    treatment: row.treatment || "",
    certification: row.certification || "",
    metal: row.metal || "",
    jewelleryType: row.jewellery_type || "",
    birthMonth: row.birth_month,
    callForPrice: !!row.call_for_price,
    stock: row.stock,
    swatch: row.swatch,
    imageUrl: row.image_url || "",
    featured: !!row.is_featured,
    bestseller: !!row.is_bestseller,
    limited: !!row.is_limited,
    vault: !!row.is_vault,
    purpose: row.purpose || "",
    price: row.call_for_price ? null : money(row.price_cents, currency),
    compareAt: row.compare_cents ? money(row.compare_cents, currency) : null,
    priceCents: row.price_cents,
    compareCents: row.compare_cents,
    currency: currency.code,
    symbol: currency.symbol,
    categoryId: row.category_id,
    categoryName: row.category_name || "",
    categorySlug: row.category_slug || "",
    shopId: row.shop_id || null,
    shopName: row.shop_name || "",
    shopSlug: row.shop_slug || "",
    shopCity: row.shop_city || "",
    collectionId: row.collection_id,
    collectionName: row.collection_name || "",
    collectionSlug: row.collection_slug || "",
    active: row.active == null ? true : !!row.active,
    sortOrder: row.sort_order,
  };
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
         col.name AS collection_name, col.slug AS collection_slug,
         s.name AS shop_name, s.slug AS shop_slug, s.city AS shop_city
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories col ON col.id = p.collection_id
  LEFT JOIN shops s ON s.id = p.shop_id
`;

function listProducts(query, currency, { includeInactive = false, shopId = null } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) {
    where.push("p.active = 1");
    where.push("s.active = 1");
  }
  if (shopId) {
    where.push("p.shop_id = ?");
    params.push(shopId);
  }
  if (query.shop) {
    where.push("s.slug = ?");
    params.push(query.shop);
  }
  if (query.category) {
    const match = categoryMatch(query.category);
    if (match) {
      const marks = match.ids.map(() => "?").join(", ");
      if (match.kind === "collection") {
        where.push(`p.collection_id IN (${marks})`);
        params.push(...match.ids);
      } else {
        where.push(`(p.category_id IN (${marks}) OR p.collection_id IN (${marks}))`);
        params.push(...match.ids, ...match.ids);
      }
    }
  }
  if (query.collection) {
    where.push("col.slug = ?");
    params.push(query.collection);
  }
  if (query.kind) {
    where.push("p.kind = ?");
    params.push(query.kind);
  }
  if (query.q) {
    where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.origin LIKE ? OR p.summary LIKE ? OR p.benefit LIKE ?)");
    const like = `%${String(query.q).trim()}%`;
    params.push(like, like, like, like, like);
  }
  if (query.purpose) {
    where.push("p.purpose = ?");
    params.push(query.purpose);
  }
  if (query.origin) {
    where.push("p.origin = ?");
    params.push(query.origin);
  }
  if (query.treatment) {
    where.push("p.treatment = ?");
    params.push(query.treatment);
  }
  if (query.shape) {
    where.push("p.shape = ?");
    params.push(query.shape);
  }
  if (query.metal) {
    where.push("p.metal = ?");
    params.push(query.metal);
  }
  if (query.certification) {
    where.push("p.certification = ?");
    params.push(query.certification);
  }
  if (query.minPrice != null && query.minPrice !== "") {
    where.push("p.call_for_price = 0 AND p.price_cents >= ?");
    params.push(Math.round(Number(query.minPrice) * 100));
  }
  if (query.maxPrice != null && query.maxPrice !== "") {
    where.push("p.call_for_price = 0 AND p.price_cents <= ?");
    params.push(Math.round(Number(query.maxPrice) * 100));
  }
  if (query.minCarat != null && query.minCarat !== "") {
    where.push("p.carat >= ?");
    params.push(Number(query.minCarat));
  }
  if (query.maxCarat != null && query.maxCarat !== "") {
    where.push("p.carat <= ?");
    params.push(Number(query.maxCarat));
  }
  if (query.birthMonth) {
    where.push("p.birth_month = ?");
    params.push(Number(query.birthMonth));
  }
  if (query.featured === "1") where.push("p.is_featured = 1");
  if (query.bestseller === "1") where.push("p.is_bestseller = 1");
  if (query.limited === "1") where.push("p.is_limited = 1");
  if (query.vault === "1") where.push("p.is_vault = 1");

  const sorts = {
    price_asc: "p.call_for_price ASC, p.price_cents ASC",
    price_desc: "p.call_for_price ASC, p.price_cents DESC",
    carat_asc: "p.carat ASC",
    carat_desc: "p.carat DESC",
    newest: "p.id DESC",
    position: "p.sort_order ASC, p.id DESC",
  };
  const order = sorts[query.sort] || sorts.position;
  const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order}`;
  return many(sql, ...params).map((row) => presentProduct(row, currency));
}

function descendantIds(id) {
  const ids = [id];
  for (const child of many("SELECT id FROM categories WHERE parent_id = ?", id)) {
    ids.push(...descendantIds(child.id));
  }
  return ids;
}

function categoryMatch(slugOrId) {
  const category = one("SELECT * FROM categories WHERE slug = ? OR CAST(id AS TEXT) = ?", slugOrId, String(slugOrId));
  if (!category) return null;
  return { kind: category.kind, ids: descendantIds(category.id) };
}

function categoryTree() {
  const rows = many("SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name");
  const grouped = new Map();
  for (const row of rows) {
    const key = row.parent_id || 0;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const build = (parentId) => (grouped.get(parentId) || []).filter((row) => row.show_in_nav).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    group: row.group_name || "",
    description: row.description || "",
    children: build(row.id),
  }));
  return build(0);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function flags(body, keys) {
  const out = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key] ? 1 : 0;
  }
  return out;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vijayalakshmi-gems" });
});

app.post("/api/auth/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();
  const key = phoneKey(phone);
  const problem = registrationError({ name, email, password, phone });
  if (problem) return res.status(400).json({ error: problem });
  if (one("SELECT id FROM users WHERE email = ?", email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }
  if (one("SELECT id FROM users WHERE phone_key = ?", key)) {
    return res.status(409).json({ error: "An account with that phone number already exists." });
  }
  const id = run(
    "INSERT INTO users (name, email, phone, phone_key, password_hash, role) VALUES (?, ?, ?, ?, ?, 'customer')",
    name,
    email,
    phone,
    key,
    hashPassword(password),
  ).id;
  const user = one("SELECT * FROM users WHERE id = ?", id);
  res.status(201).json({ token: signUser(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
  const password = String(req.body.password || "");
  const attemptKey = req.ip || "local";
  if (tooManyAttempts(attemptKey)) {
    return res.status(429).json({ error: "Too many sign-in attempts. Wait a few minutes and try again." });
  }
  const user = isEmail(identifier)
    ? one("SELECT * FROM users WHERE email = ?", normalizeEmail(identifier))
    : one("SELECT * FROM users WHERE phone_key = ?", phoneKey(identifier));
  const matches = checkPassword(password, user?.password_hash);
  if (!user || !matches || !password) {
    recordAttempt(attemptKey);
    return res.status(401).json({ error: "Email, phone, or password is incorrect." });
  }
  clearAttempts(attemptKey);
  res.json({ token: signUser(user), user: accountView(user) });
});

app.get("/api/auth/me", requireUser, (req, res) => {
  const user = one("SELECT * FROM users WHERE id = ?", req.user.id);
  if (!user) return res.status(401).json({ error: "Sign in required" });
  res.json({ user: accountView(user) });
});

app.patch("/api/auth/profile", requireUser, (req, res) => {
  const current = one("SELECT * FROM users WHERE id = ?", req.user.id);
  if (!current) return res.status(401).json({ error: "Sign in required" });
  const name = String(req.body.name || current.name).trim();
  const phone = String(req.body.phone ?? current.phone ?? "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Enter your name." });
  if (phone && !isPhone(phone)) return res.status(400).json({ error: "Enter a valid phone number." });
  const key = phone ? phoneKey(phone) : "";
  const taken = key ? one("SELECT id FROM users WHERE phone_key = ? AND id != ?", key, current.id) : null;
  if (taken) return res.status(409).json({ error: "An account with that phone number already exists." });
  run("UPDATE users SET name = ?, phone = ?, phone_key = ? WHERE id = ?", name, phone, key || null, current.id);
  res.json({ user: publicUser(one("SELECT * FROM users WHERE id = ?", current.id)) });
});

app.post("/api/auth/password", requireUser, (req, res) => {
  const current = one("SELECT * FROM users WHERE id = ?", req.user.id);
  const next = String(req.body.password || "");
  if (!current || !checkPassword(String(req.body.current || ""), current.password_hash)) {
    return res.status(401).json({ error: "The current password is incorrect." });
  }
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
    return res.status(400).json({ error: "Use at least 8 characters, with letters and a number." });
  }
  run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(next), current.id);
  res.json({ ok: true });
});

app.get("/api/bootstrap", (req, res) => {
  const currency = currencyFrom(req);
  const settings = getSettings();
  res.json({
    settings,
    currencies: many("SELECT code, name, symbol, rate, is_default AS isDefault FROM currencies WHERE active = 1 ORDER BY sort_order"),
    navigation: categoryTree(),
    banners: many("SELECT * FROM banners WHERE active = 1 AND placement = 'home' ORDER BY sort_order").map(camel),
    blocks: many("SELECT * FROM content_blocks WHERE active = 1 ORDER BY sort_order, id").map(camel),
    purposes: many("SELECT slug, name, planet, gemstone, blurb FROM purposes WHERE active = 1 ORDER BY sort_order"),
    filters: many("SELECT * FROM filter_options WHERE active = 1 ORDER BY filter_key, sort_order").map(camel),
    featured: listProducts({ featured: "1" }, currency),
    bestsellers: listProducts({ bestseller: "1" }, currency),
    limited: listProducts({ limited: "1" }, currency),
    vault: listProducts({ vault: "1" }, currency).slice(0, 4),
    reviews: many("SELECT id, author, rating, title, body FROM reviews WHERE published = 1 ORDER BY id DESC LIMIT 8"),
    posts: many("SELECT slug, title, excerpt, created_at AS createdAt FROM blog_posts WHERE published = 1 ORDER BY id DESC LIMIT 4"),
    pages: many("SELECT slug, title FROM pages WHERE active = 1 AND show_in_help = 1 ORDER BY sort_order"),
    shops: many("SELECT id, name, slug, city, phone FROM shops WHERE active = 1 ORDER BY name"),
    currency: { code: currency.code, symbol: currency.symbol, rate: currency.rate },
  });
});

app.get("/api/categories", (_req, res) => {
  res.json({
    tree: categoryTree(),
    items: many("SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name"),
  });
});

app.get("/api/products", (req, res) => {
  res.json({ items: listProducts(req.query, currencyFrom(req)) });
});

app.get("/api/products/:slug", (req, res) => {
  const currency = currencyFrom(req);
  const row = one(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`, req.params.slug);
  if (!row) return res.status(404).json({ error: "That piece is no longer listed." });
  const product = presentProduct(row, currency);
  const related = listProducts({ category: row.category_slug }, currency).filter((item) => item.id !== row.id).slice(0, 4);
  const reviews = many(
    "SELECT id, author, rating, title, body, verified, created_at AS createdAt FROM reviews WHERE product_id = ? AND published = 1 ORDER BY id DESC",
    row.id,
  );
  res.json({ product, related, reviews });
});

app.post("/api/products/:slug/reviews", requireUser, (req, res) => {
  const product = one("SELECT id FROM products WHERE slug = ? AND active = 1", req.params.slug);
  if (!product) return res.status(404).json({ error: "That piece is no longer listed." });
  const rating = Number(req.body.rating);
  const body = String(req.body.body || "").trim();
  const title = String(req.body.title || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Choose a rating from 1 to 5." });
  if (body.length < 8) return res.status(400).json({ error: "Write a few words about the piece." });
  const bought = one(
    `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status != 'cancelled'`,
    req.user.id,
    product.id,
  );
  const existing = one("SELECT id FROM reviews WHERE user_id = ? AND product_id = ?", req.user.id, product.id);
  if (existing) {
    run(
      "UPDATE reviews SET rating = ?, title = ?, body = ?, verified = ?, published = 1 WHERE id = ?",
      rating, title, body, bought ? 1 : 0, existing.id,
    );
  } else {
    run(
      "INSERT INTO reviews (product_id, user_id, author, rating, title, body, verified, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      product.id, req.user.id, req.user.name, rating, title, body, bought ? 1 : 0,
    );
  }
  res.status(201).json({ ok: true });
});

app.get("/api/blog", (_req, res) => {
  res.json({ items: many("SELECT slug, title, excerpt, created_at AS createdAt FROM blog_posts WHERE published = 1 ORDER BY id DESC") });
});

app.get("/api/blog/:slug", (req, res) => {
  const post = one("SELECT * FROM blog_posts WHERE slug = ? AND published = 1", req.params.slug);
  if (!post) return res.status(404).json({ error: "Article not found." });
  res.json({ post });
});

app.get("/api/pages/:slug", (req, res) => {
  const page = one("SELECT * FROM pages WHERE slug = ? AND active = 1", req.params.slug);
  if (!page) return res.status(404).json({ error: "Page not found." });
  res.json({ page });
});

app.post("/api/recommendations", (req, res) => {
  const birthDate = String(req.body.birthDate || "");
  const purpose = String(req.body.purpose || "");
  const weight = req.body.weightKg === "" || req.body.weightKg == null ? null : Number(req.body.weightKg);
  if (!birthDate && !purpose) {
    return res.status(400).json({ error: "Add a birth date or choose a purpose." });
  }
  const result = buildRecommendation({ birthDate, purpose, weightKg: weight });
  const currency = currencyFrom(req);
  const products = result.productSlugs.length
    ? listProducts({}, currency).filter((item) => result.productSlugs.includes(item.slug)).slice(0, 8)
    : [];
  const settings = getSettings();
  const id = run(
    `INSERT INTO recommendation_requests
      (user_id, name, phone, email, birth_date, birth_time, birth_place, body_weight_kg, purpose, rashi, life_stone, purpose_stone, suggested_carat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user?.id || null,
    String(req.body.name || req.user?.name || ""),
    String(req.body.phone || ""),
    String(req.body.email || req.user?.email || ""),
    birthDate,
    String(req.body.birthTime || ""),
    String(req.body.birthPlace || ""),
    weight,
    purpose,
    result.rashi?.name || "",
    result.lifeStone?.name || "",
    result.purposeStone?.name || "",
    result.suggestedCarat,
  ).id;
  res.json({
    id,
    ...result,
    products,
    disclaimer: settings.recommendation_disclaimer || "",
  });
});

app.post("/api/enquiries", (req, res) => {
  const type = String(req.body.type || "expert");
  const message = String(req.body.message || "").trim();
  const phone = String(req.body.phone || "").trim();
  if (!message && !phone) return res.status(400).json({ error: "Leave a phone number or a message." });
  const product = req.body.productId ? one("SELECT shop_id FROM products WHERE id = ?", req.body.productId) : null;
  const id = run(
    `INSERT INTO enquiries (type, name, phone, email, message, product_id, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    type,
    String(req.body.name || ""),
    phone,
    String(req.body.email || ""),
    message,
    req.body.productId || null,
    product?.shop_id || null,
  ).id;
  res.status(201).json({ id, status: "new" });
});

app.get("/api/wishlist", requireUser, (req, res) => {
  const currency = currencyFrom(req);
  const rows = many(
    `${PRODUCT_SELECT}
     JOIN wishlist w ON w.product_id = p.id
     WHERE w.user_id = ? AND p.active = 1
     ORDER BY w.created_at DESC`,
    req.user.id,
  );
  res.json({ items: rows.map((row) => presentProduct(row, currency)) });
});

app.post("/api/wishlist", requireUser, (req, res) => {
  const product = one("SELECT id FROM products WHERE id = ? AND active = 1", req.body.productId);
  if (!product) return res.status(404).json({ error: "That piece is no longer listed." });
  run("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)", req.user.id, product.id);
  res.status(201).json({ ok: true });
});

app.delete("/api/wishlist/:productId", requireUser, (req, res) => {
  run("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", req.user.id, Number(req.params.productId));
  res.json({ ok: true });
});

function publicAddress(row) {
  return {
    id: row.id,
    label: row.label || "",
    name: row.name,
    phone: row.phone || "",
    line1: row.line1,
    line2: row.line2 || "",
    city: row.city,
    state: row.state || "",
    postal: row.postal_code || "",
    country: row.country,
    isDefault: !!row.is_default,
  };
}

function readAddress(body) {
  const address = {
    label: String(body.label || "").trim(),
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    line1: String(body.line1 || "").trim(),
    line2: String(body.line2 || "").trim(),
    city: String(body.city || "").trim(),
    state: String(body.state || "").trim(),
    postal: String(body.postal || body.postalCode || "").trim(),
    country: String(body.country || "India").trim(),
  };
  if (!address.name || !address.phone || !address.line1 || !address.city || !address.postal || !address.country) {
    return { error: "Name, phone, address, city, postal code, and country are required." };
  }
  return { address };
}

app.get("/api/addresses", requireUser, (req, res) => {
  const rows = many("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC", req.user.id);
  res.json({ items: rows.map(publicAddress) });
});

app.post("/api/addresses", requireUser, (req, res) => {
  const parsed = readAddress(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const address = parsed.address;
  const makeDefault = req.body.isDefault || !one("SELECT id FROM addresses WHERE user_id = ?", req.user.id);
  if (makeDefault) run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", req.user.id);
  const id = run(
    `INSERT INTO addresses (user_id, label, name, phone, line1, line2, city, state, postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, address.label, address.name, address.phone, address.line1, address.line2, address.city, address.state, address.postal, address.country, makeDefault ? 1 : 0,
  ).id;
  res.status(201).json({ address: publicAddress(one("SELECT * FROM addresses WHERE id = ?", id)) });
});

app.patch("/api/addresses/:id", requireUser, (req, res) => {
  const current = one("SELECT * FROM addresses WHERE id = ? AND user_id = ?", Number(req.params.id), req.user.id);
  if (!current) return res.status(404).json({ error: "Address not found." });
  if (req.body.isDefault) run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", req.user.id);
  run("UPDATE addresses SET is_default = ? WHERE id = ?", req.body.isDefault ? 1 : current.is_default, current.id);
  res.json({ address: publicAddress(one("SELECT * FROM addresses WHERE id = ?", current.id)) });
});

app.delete("/api/addresses/:id", requireUser, (req, res) => {
  const current = one("SELECT * FROM addresses WHERE id = ? AND user_id = ?", Number(req.params.id), req.user.id);
  if (!current) return res.status(404).json({ error: "Address not found." });
  run("DELETE FROM addresses WHERE id = ?", current.id);
  if (current.is_default) {
    const next = one("SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC", req.user.id);
    if (next) run("UPDATE addresses SET is_default = 1 WHERE id = ?", next.id);
  }
  res.json({ ok: true });
});

function cartPayload(userId, currency) {
  const rows = many(
    `${PRODUCT_SELECT}
     JOIN cart_items ci ON ci.product_id = p.id
     WHERE ci.user_id = ?
     ORDER BY p.name`,
    userId,
  );
  const items = rows.map((row) => {
    const product = presentProduct(row, currency);
    const qtyRow = one("SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?", userId, row.id);
    return { ...product, qty: qtyRow.qty, line: product.price == null ? null : Math.round(product.price * qtyRow.qty * 100) / 100 };
  });
  const subtotal = Math.round(items.reduce((sum, item) => sum + (item.line || 0), 0) * 100) / 100;
  return { items, subtotal, currency: currency.code, symbol: currency.symbol };
}

app.get("/api/cart", requireUser, (req, res) => {
  res.json(cartPayload(req.user.id, currencyFrom(req)));
});

app.post("/api/cart", requireUser, (req, res) => {
  const product = one("SELECT * FROM products WHERE id = ? AND active = 1", req.body.productId);
  if (!product) return res.status(404).json({ error: "That piece is no longer listed." });
  if (product.call_for_price) return res.status(400).json({ error: "This vault piece is priced by the desk. Send an enquiry instead." });
  const qty = Math.max(1, Number(req.body.qty) || 1);
  if (qty > product.stock) return res.status(400).json({ error: "Not enough pieces are in stock." });
  const existing = one("SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?", req.user.id, product.id);
  const next = (existing?.qty || 0) + qty;
  if (next > product.stock) return res.status(400).json({ error: "Not enough pieces are in stock." });
  if (existing) {
    run("UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?", next, req.user.id, product.id);
  } else {
    run("INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)", req.user.id, product.id, qty);
  }
  res.status(201).json(cartPayload(req.user.id, currencyFrom(req)));
});

app.patch("/api/cart/:productId", requireUser, (req, res) => {
  const qty = Number(req.body.qty);
  const productId = Number(req.params.productId);
  if (qty <= 0) {
    run("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", req.user.id, productId);
  } else {
    const product = one("SELECT stock, call_for_price FROM products WHERE id = ?", productId);
    if (!product || product.call_for_price) return res.status(400).json({ error: "That piece cannot be updated in the bag." });
    if (qty > product.stock) return res.status(400).json({ error: "Not enough pieces are in stock." });
    run("UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?", qty, req.user.id, productId);
  }
  res.json(cartPayload(req.user.id, currencyFrom(req)));
});

app.delete("/api/cart/:productId", requireUser, (req, res) => {
  run("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", req.user.id, Number(req.params.productId));
  res.json(cartPayload(req.user.id, currencyFrom(req)));
});

function presentQuote(totals, currency) {
  return {
    subtotal: money(totals.subtotalCents, currency),
    discount: money(totals.discountCents, currency),
    shipping: money(totals.shippingCents, currency),
    tax: money(totals.taxCents, currency),
    total: money(totals.totalCents, currency),
    symbol: currency.symbol,
    currency: currency.code,
    couponCode: totals.couponCode,
    couponError: totals.couponError,
    shippingMethod: totals.shippingMethod,
    shippingName: totals.shippingName,
    taxPercent: totals.taxPercent,
  };
}

app.get("/api/checkout/options", (req, res) => {
  const currency = currencyFrom(req);
  res.json({
    taxPercent: taxPercent(),
    shipping: SHIPPING.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.detail,
      price: item.cents ? money(item.cents, currency) : 0,
      symbol: currency.symbol,
    })),
    payments: PAYMENTS,
  });
});

app.post("/api/checkout/quote", requireUser, (req, res) => {
  const currency = currencyFrom(req);
  const cart = cartPayload(req.user.id, currency);
  const totals = quoteTotals({
    items: cart.items,
    couponCode: req.body.coupon,
    shippingId: req.body.shippingMethod,
  });
  res.json({ ...presentQuote(totals, currency), items: cart.items.length });
});

function shippingFrom(req) {
  if (req.body.addressId) {
    const saved = one("SELECT * FROM addresses WHERE id = ? AND user_id = ?", Number(req.body.addressId), req.user.id);
    if (!saved) return { error: "Choose a saved address." };
    return { address: publicAddress(saved) };
  }
  return readAddress(req.body.shipping || {});
}

app.post("/api/checkout", requireUser, (req, res) => {
  const currency = currencyFrom(req);
  const cart = cartPayload(req.user.id, currency);
  if (!cart.items.length) return res.status(400).json({ error: "Your bag is empty." });
  const parsed = shippingFrom(req);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const pay = paymentMethod(req.body.paymentMethod || "cod");
  if (!pay) return res.status(400).json({ error: "Choose how you will pay." });
  const totals = quoteTotals({
    items: cart.items,
    couponCode: req.body.coupon,
    shippingId: req.body.shippingMethod,
  });
  if (req.body.coupon && totals.couponError) return res.status(400).json({ error: totals.couponError });
  const ship = parsed.address;
  const method = shippingMethod(totals.shippingMethod);
  db.exec("BEGIN");
  try {
    for (const item of cart.items) {
      const fresh = one("SELECT stock, name FROM products WHERE id = ?", item.id);
      if (!fresh || fresh.stock < item.qty) throw fail(400, `${item.name} is no longer available in that quantity.`);
      run("UPDATE products SET stock = stock - ? WHERE id = ?", item.qty, item.id);
    }
    const orderId = run(
      `INSERT INTO orders (
        user_id, status, currency, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        coupon_code, shipping_method, payment_method, payment_status, note,
        ship_name, ship_phone, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ship_country
      ) VALUES (?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      currency.code,
      totals.subtotalCents,
      totals.discountCents,
      totals.shippingCents,
      totals.taxCents,
      totals.totalCents,
      totals.couponCode,
      method.id,
      pay.id,
      pay.id === "cod" ? "unpaid" : "due",
      String(req.body.note || ""),
      ship.name,
      ship.phone,
      ship.line1,
      ship.line2 || "",
      ship.city,
      ship.state || "",
      ship.postal || "",
      ship.country,
    ).id;
    for (const item of cart.items) {
      run(
        "INSERT INTO order_items (order_id, product_id, name, sku, qty, unit_cents) VALUES (?, ?, ?, ?, ?, ?)",
        orderId, item.id, item.name, item.sku, item.qty, item.priceCents,
      );
    }
    if (req.body.saveAddress && !req.body.addressId) {
      const makeDefault = !one("SELECT id FROM addresses WHERE user_id = ?", req.user.id);
      run(
        `INSERT INTO addresses (user_id, label, name, phone, line1, line2, city, state, postal_code, country, is_default)
         VALUES (?, 'Home', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        req.user.id, ship.name, ship.phone, ship.line1, ship.line2 || "", ship.city, ship.state || "", ship.postal || "", ship.country, makeDefault ? 1 : 0,
      );
    }
    run("DELETE FROM cart_items WHERE user_id = ?", req.user.id);
    db.exec("COMMIT");
    res.status(201).json({ order: orderDetail(orderId) });
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
});

function orderDetail(id) {
  const order = one(
    `SELECT id, user_id AS userId, status, currency,
            subtotal_cents AS subtotalCents, COALESCE(discount_cents, 0) AS discountCents,
            COALESCE(shipping_cents, 0) AS shippingCents, COALESCE(tax_cents, 0) AS taxCents,
            COALESCE(total_cents, subtotal_cents) AS totalCents,
            COALESCE(coupon_code, '') AS couponCode, COALESCE(shipping_method, '') AS shippingMethod,
            COALESCE(payment_method, '') AS paymentMethod, COALESCE(payment_status, 'unpaid') AS paymentStatus,
            note, ship_name AS shipName, ship_phone AS shipPhone, ship_line1 AS shipLine1,
            COALESCE(ship_line2, '') AS shipLine2, ship_city AS shipCity, COALESCE(ship_state, '') AS shipState,
            COALESCE(ship_postal, '') AS shipPostal, ship_country AS shipCountry, created_at AS createdAt
     FROM orders WHERE id = ?`,
    id,
  );
  if (!order) return null;
  const cur = one("SELECT * FROM currencies WHERE code = ?", order.currency) || { rate: 1, symbol: "$", code: order.currency };
  order.items = many(
    "SELECT product_id AS productId, name, sku, qty, unit_cents AS unitCents FROM order_items WHERE order_id = ?",
    id,
  ).map((item) => ({ ...item, unit: money(item.unitCents, cur), line: money(item.unitCents * item.qty, cur) }));
  order.subtotal = money(order.subtotalCents, cur);
  order.discount = money(order.discountCents, cur);
  order.shipping = money(order.shippingCents, cur);
  order.tax = money(order.taxCents, cur);
  order.total = money(order.totalCents, cur);
  order.symbol = cur.symbol;
  order.shippingName = shippingMethod(order.shippingMethod).name;
  order.paymentName = paymentMethod(order.paymentMethod)?.name || order.paymentMethod;
  return order;
}

function cancelOrder(id) {
  const order = one("SELECT id, status FROM orders WHERE id = ?", id);
  if (!order) return { error: "Order not found.", status: 404 };
  if (order.status === "cancelled") return { order: orderDetail(id) };
  if (!["placed", "confirmed"].includes(order.status)) {
    return { error: "This order has already left the atelier.", status: 400 };
  }
  db.exec("BEGIN");
  try {
    for (const item of many("SELECT product_id, qty FROM order_items WHERE order_id = ?", id)) {
      if (item.product_id) run("UPDATE products SET stock = stock + ? WHERE id = ?", item.qty, item.product_id);
    }
    run("UPDATE orders SET status = 'cancelled' WHERE id = ?", id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { order: orderDetail(id) };
}

app.get("/api/orders", requireUser, (req, res) => {
  const ids = many("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC", req.user.id);
  res.json({ items: ids.map((row) => orderDetail(row.id)) });
});

app.get("/api/orders/:id", requireUser, (req, res) => {
  const order = orderDetail(Number(req.params.id));
  if (!order || (order.userId !== req.user.id && !["admin", "superadmin", "shop"].includes(req.user.role))) {
    return res.status(404).json({ error: "Order not found." });
  }
  res.json({ order });
});

app.post("/api/orders/:id/cancel", requireUser, (req, res) => {
  const order = orderDetail(Number(req.params.id));
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: "Order not found." });
  if (order.status !== "placed") return res.status(400).json({ error: "Only a new order can be cancelled here. Ask the desk." });
  const result = cancelOrder(order.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ order: result.order });
});

function adminList(res, sql, ...params) {
  res.json({ items: many(sql, ...params) });
}

app.get("/api/admin/settings", desk, (req, res) => {
  if (!gate(req, res, "settings", { superOnly: true })) return;
  res.json({ settings: getSettings() });
});

app.put("/api/admin/settings", desk, (req, res) => {
  if (!gate(req, res, "settings", { superOnly: true })) return;
  const allowed = ["brand", "tagline", "company", "sales_hours", "support_hours", "carat_divisor", "recommendation_disclaimer", "phones", "locations"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) setSetting(key, req.body[key]);
  }
  res.json({ settings: getSettings() });
});

app.get("/api/admin/shop", desk, (req, res) => {
  if (!gate(req, res, "settings")) return;
  if (!req.desk.shopId) return res.status(404).json({ error: "This login is not linked to a shop." });
  const shop = one("SELECT id, name, slug, city, phone, active FROM shops WHERE id = ?", req.desk.shopId);
  res.json({ shop });
});

app.put("/api/admin/shop", desk, (req, res) => {
  if (!gate(req, res, "settings")) return;
  if (!req.desk.shopId) return res.status(400).json({ error: "This login is not linked to a shop." });
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Enter the shop name." });
  run(
    "UPDATE shops SET name = ?, city = ?, phone = ? WHERE id = ?",
    name,
    String(req.body.city || "").trim(),
    String(req.body.phone || "").trim(),
    req.desk.shopId,
  );
  res.json({ shop: one("SELECT id, name, slug, city, phone, active FROM shops WHERE id = ?", req.desk.shopId) });
});

function presentShop(shop) {
  const owner = one("SELECT id, name, email, phone, features, role_id, commission_percent FROM users WHERE shop_id = ? AND role = 'shop' ORDER BY id LIMIT 1", shop.id);
  const role = owner?.role_id ? one("SELECT id, name FROM roles WHERE id = ?", owner.role_id) : null;
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    city: shop.city || "",
    phone: shop.phone || "",
    active: !!shop.active,
    roleId: role?.id || "",
    roleName: role?.name || "",
    commissionPercent: owner ? Number(owner.commission_percent) || 0 : 0,
    features: owner ? cleanFeatures(owner.features) : { gemstones: false, jewellery: false },
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone || "" } : null,
  };
}

function saveShopOwner(shopId, body, existing) {
  const name = String(body.ownerName || "").trim();
  const email = normalizeEmail(body.email);
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  const features = JSON.stringify(cleanFeatures(body.features));
  const roleId = Number(body.roleId);
  const percent = Number(body.commissionPercent);
  if (!one("SELECT id FROM roles WHERE id = ?", roleId)) return { error: "Choose a role." };
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: "Enter a percentage from 0 to 100." };
  if (!name || name.length < 2) return { error: "Enter the owner's name." };
  if (!isEmail(email)) return { error: "Enter the owner's email." };
  if (!isPhone(phone)) return { error: "Enter the owner's phone." };
  if (!existing && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || password.length < 8)) {
    return { error: "Use at least 8 characters, with letters and a number." };
  }
  if (password && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || password.length < 8)) {
    return { error: "Use at least 8 characters, with letters and a number." };
  }
  const key = phoneKey(phone);
  const emailTaken = one("SELECT id FROM users WHERE email = ? AND id != ?", email, existing?.id || 0);
  if (emailTaken) return { error: "An account with that email already exists." };
  const phoneTaken = one("SELECT id FROM users WHERE phone_key = ? AND id != ?", key, existing?.id || 0);
  if (phoneTaken) return { error: "An account with that phone number already exists." };
  if (existing) {
    run(
      "UPDATE users SET name = ?, email = ?, phone = ?, phone_key = ?, features = ?, role_id = ?, commission_percent = ? WHERE id = ?",
      name, email, phone, key, features, roleId, percent, existing.id,
    );
    if (password) run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), existing.id);
    return { id: existing.id };
  }
  const id = run(
    "INSERT INTO users (name, email, phone, phone_key, password_hash, role, shop_id, features, role_id, commission_percent) VALUES (?, ?, ?, ?, ?, 'shop', ?, ?, ?, ?)",
    name, email, phone, key, hashPassword(password), shopId, features, roleId, percent,
  ).id;
  return { id };
}

app.get("/api/admin/shops", desk, (req, res) => {
  if (!gate(req, res, "shops", { superOnly: true })) return;
  res.json({
    items: many("SELECT * FROM shops ORDER BY name").map(presentShop),
    roles: many("SELECT id, name FROM roles ORDER BY name"),
    features: ASSIGNABLE_FEATURES,
  });
});

app.get("/api/admin/dashboard", desk, (req, res) => {
  if (!isSuper(req.desk)) return res.status(403).json({ error: "Only the super admin can do this." });
  const currency = currencyFrom(req);
  const rows = many(
    `SELECT s.id AS shopId, s.name AS shopName,
            u.name AS ownerName, u.email AS ownerEmail,
            COALESCE(u.commission_percent, 0) AS commissionPercent,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL AND o.status != 'cancelled' THEN oi.unit_cents * oi.qty ELSE 0 END), 0) AS earnedCents
     FROM shops s
     LEFT JOIN users u ON u.shop_id = s.id AND u.role = 'shop'
     LEFT JOIN products p ON p.shop_id = s.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     GROUP BY s.id, s.name, u.name, u.email, u.commission_percent
     ORDER BY s.name`,
  );
  const shops = rows.map((row) => {
    const shareCents = Math.round(Number(row.earnedCents) * Number(row.commissionPercent) / 100);
    return {
      shopId: row.shopId,
      shopName: row.shopName,
      ownerName: row.ownerName || "",
      ownerEmail: row.ownerEmail || "",
      commissionPercent: Number(row.commissionPercent) || 0,
      earned: money(row.earnedCents, currency),
      share: money(shareCents, currency),
    };
  });
  const earnedCents = rows.reduce((sum, row) => sum + Number(row.earnedCents), 0);
  const shareCents = rows.reduce((sum, row) => sum + Math.round(Number(row.earnedCents) * Number(row.commissionPercent) / 100), 0);
  res.json({
    symbol: currency.symbol,
    currency: currency.code,
    earned: money(earnedCents, currency),
    share: money(shareCents, currency),
    shops,
  });
});

function presentRole(role) {
  return {
    id: role.id,
    name: role.name,
    menus: cleanMenus(role.menus),
    users: one("SELECT COUNT(*) AS count FROM users WHERE role_id = ?", role.id).count,
  };
}

app.get("/api/admin/roles", desk, (req, res) => {
  if (!isSuper(req.desk)) return res.status(403).json({ error: "Only the super admin can do this." });
  res.json({
    items: many("SELECT * FROM roles ORDER BY name").map(presentRole),
    menus: ASSIGNABLE_MENUS,
  });
});

app.post("/api/admin/roles", desk, (req, res) => {
  if (!isSuper(req.desk)) return res.status(403).json({ error: "Only the super admin can do this." });
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Enter a role name." });
  if (one("SELECT id FROM roles WHERE name = ?", name)) return res.status(409).json({ error: "That role name is already used." });
  const id = run("INSERT INTO roles (name, menus) VALUES (?, ?)", name, JSON.stringify(cleanMenus(req.body.menus))).id;
  res.status(201).json({ role: presentRole(one("SELECT * FROM roles WHERE id = ?", id)) });
});

app.patch("/api/admin/roles/:id", desk, (req, res) => {
  if (!isSuper(req.desk)) return res.status(403).json({ error: "Only the super admin can do this." });
  const role = one("SELECT * FROM roles WHERE id = ?", Number(req.params.id));
  if (!role) return res.status(404).json({ error: "Role not found." });
  const name = String(req.body.name || role.name).trim();
  if (!name) return res.status(400).json({ error: "Enter a role name." });
  const taken = one("SELECT id FROM roles WHERE name = ? AND id != ?", name, role.id);
  if (taken) return res.status(409).json({ error: "That role name is already used." });
  run("UPDATE roles SET name = ?, menus = ? WHERE id = ?", name, JSON.stringify(cleanMenus(req.body.menus)), role.id);
  res.json({ role: presentRole(one("SELECT * FROM roles WHERE id = ?", role.id)) });
});

app.delete("/api/admin/roles/:id", desk, (req, res) => {
  if (!isSuper(req.desk)) return res.status(403).json({ error: "Only the super admin can do this." });
  const id = Number(req.params.id);
  if (one("SELECT id FROM users WHERE role_id = ?", id)) {
    return res.status(400).json({ error: "This role is assigned to a shop user." });
  }
  run("DELETE FROM roles WHERE id = ?", id);
  res.json({ ok: true });
});

app.post("/api/admin/shops", desk, (req, res) => {
  if (!gate(req, res, "shops", { superOnly: true })) return;
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Enter the shop name." });
  let slug = slugify(req.body.slug || name) || `shop-${Date.now()}`;
  if (one("SELECT id FROM shops WHERE slug = ?", slug)) slug = `${slug}-${Date.now()}`;
  const shopId = run(
    "INSERT INTO shops (name, slug, city, phone, active) VALUES (?, ?, ?, ?, ?)",
    name,
    slug,
    String(req.body.city || "").trim(),
    String(req.body.shopPhone || "").trim(),
    req.body.active === false ? 0 : 1,
  ).id;
  const saved = saveShopOwner(shopId, req.body, null);
  if (saved.error) {
    run("DELETE FROM shops WHERE id = ?", shopId);
    return res.status(400).json({ error: saved.error });
  }
  res.status(201).json({ shop: presentShop(one("SELECT * FROM shops WHERE id = ?", shopId)) });
});

app.patch("/api/admin/shops/:id", desk, (req, res) => {
  if (!gate(req, res, "shops", { superOnly: true })) return;
  const shop = one("SELECT * FROM shops WHERE id = ?", Number(req.params.id));
  if (!shop) return res.status(404).json({ error: "Shop not found." });
  const name = String(req.body.name || shop.name).trim();
  if (!name) return res.status(400).json({ error: "Enter the shop name." });
  run(
    "UPDATE shops SET name = ?, city = ?, phone = ?, active = ? WHERE id = ?",
    name,
    String(req.body.city ?? shop.city ?? "").trim(),
    String(req.body.shopPhone ?? shop.phone ?? "").trim(),
    req.body.active === false ? 0 : 1,
    shop.id,
  );
  const owner = one("SELECT * FROM users WHERE shop_id = ? AND role = 'shop' ORDER BY id LIMIT 1", shop.id);
  const saved = saveShopOwner(shop.id, req.body, owner);
  if (saved.error) return res.status(400).json({ error: saved.error });
  res.json({ shop: presentShop(one("SELECT * FROM shops WHERE id = ?", shop.id)) });
});

app.get("/api/admin/stats", desk, (req, res) => {
  if (!gate(req, res, "desk")) return;
  const shopId = req.desk.role === "shop" ? req.desk.shopId : null;
  const productWhere = shopId ? "active = 1 AND shop_id = ?" : "active = 1";
  const productParams = shopId ? [shopId] : [];
  const orderCount = shopId
    ? one(
      `SELECT COUNT(DISTINCT o.id) AS count FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.shop_id = ?`,
      shopId,
    ).count
    : one("SELECT COUNT(*) AS count FROM orders").count;
  const enquiryCount = shopId
    ? one(
      `SELECT COUNT(*) AS count FROM enquiries e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE e.status = 'new' AND (e.shop_id = ? OR p.shop_id = ?)`,
      shopId,
      shopId,
    ).count
    : one("SELECT COUNT(*) AS count FROM enquiries WHERE status = 'new'").count;
  const customerCount = shopId
    ? one(
      `SELECT COUNT(DISTINCT u.id) AS count FROM users u
       JOIN orders o ON o.user_id = u.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE u.role = 'customer' AND p.shop_id = ?`,
      shopId,
    ).count
    : one("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").count;
  res.json({
    shops: shopId ? null : one("SELECT COUNT(*) AS count FROM shops WHERE active = 1").count,
    products: one(`SELECT COUNT(*) AS count FROM products WHERE ${productWhere}`, ...productParams).count,
    orders: orderCount,
    enquiries: enquiryCount,
    customers: customerCount,
    recommendations: isSuper(req.desk) ? one("SELECT COUNT(*) AS count FROM recommendation_requests").count : null,
    lowStock: many(
      `SELECT id, name, sku, stock FROM products WHERE ${productWhere} AND call_for_price = 0 AND stock <= 1 ORDER BY stock, name`,
      ...productParams,
    ),
  });
});

app.get("/api/admin/products", desk, (req, res) => {
  if (!gate(req, res, "pieces")) return;
  const shopId = req.desk.role === "shop" ? req.desk.shopId : null;
  res.json({ items: listProducts(req.query, currencyFrom(req), { includeInactive: true, shopId }) });
});

app.post("/api/admin/products", desk, (req, res) => {
  if (!gate(req, res, "pieces")) return;
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });
  if (req.desk.role === "shop" && !req.desk.shopId) return res.status(400).json({ error: "This login is not linked to a shop." });
  if (!kindAllowed(req.desk, body.kind || "loose")) {
    return res.status(403).json({ error: "The super admin has not enabled this for your shop." });
  }
  const slug = slugify(body.slug || name);
  const sku = String(body.sku || `VG-${Date.now()}`).trim();
  if (one("SELECT id FROM products WHERE slug = ? OR sku = ?", slug, sku)) {
    return res.status(409).json({ error: "SKU or slug already exists." });
  }
  const id = run(
    `INSERT INTO products (
      sku, slug, name, category_id, collection_id, kind, summary, description, benefit,
      carat, shape, origin, treatment, certification, metal, jewellery_type, birth_month,
      price_cents, compare_cents, call_for_price, stock, swatch, image_url, is_featured,
      is_bestseller, is_limited, is_vault, purpose, sort_order, active, shop_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sku,
    slug,
    name,
    body.categoryId || null,
    body.collectionId || null,
    body.kind || "loose",
    body.summary || "",
    body.description || "",
    body.benefit || "",
    body.carat === "" || body.carat == null ? null : Number(body.carat),
    body.shape || "",
    body.origin || "",
    body.treatment || "",
    body.certification || "",
    body.metal || "",
    body.jewelleryType || "",
    body.birthMonth || null,
    Math.round(Number(body.price || 0) * 100),
    body.compareAt === "" || body.compareAt == null ? null : Math.round(Number(body.compareAt) * 100),
    body.callForPrice ? 1 : 0,
    Number(body.stock ?? 1),
    body.swatch || "#6b1d2a",
    body.imageUrl || "",
    body.featured ? 1 : 0,
    body.bestseller ? 1 : 0,
    body.limited ? 1 : 0,
    body.vault ? 1 : 0,
    body.purpose || "",
    Number(body.sortOrder || 0),
    body.active === false ? 0 : 1,
    req.desk.shopId || null,
  ).id;
  const row = one(`${PRODUCT_SELECT} WHERE p.id = ?`, id);
  res.status(201).json({ product: presentProduct(row, currencyFrom(req)) });
});

app.patch("/api/admin/products/:id", desk, (req, res) => {
  if (!gate(req, res, "pieces")) return;
  const id = Number(req.params.id);
  const current = one("SELECT * FROM products WHERE id = ?", id);
  if (!current || (req.desk.role === "shop" && current.shop_id !== req.desk.shopId)) {
    return res.status(404).json({ error: "Product not found." });
  }
  const body = req.body || {};
  if (body.kind && !kindAllowed(req.desk, body.kind)) {
    return res.status(403).json({ error: "The super admin has not enabled this for your shop." });
  }
  const next = {
    name: body.name ?? current.name,
    slug: slugify(body.slug || body.name || current.slug),
    sku: body.sku ?? current.sku,
    category_id: body.categoryId === undefined ? current.category_id : body.categoryId || null,
    collection_id: body.collectionId === undefined ? current.collection_id : body.collectionId || null,
    kind: body.kind ?? current.kind,
    summary: body.summary ?? current.summary,
    description: body.description ?? current.description,
    benefit: body.benefit ?? current.benefit,
    carat: body.carat === undefined ? current.carat : body.carat === "" || body.carat == null ? null : Number(body.carat),
    shape: body.shape ?? current.shape,
    origin: body.origin ?? current.origin,
    treatment: body.treatment ?? current.treatment,
    certification: body.certification ?? current.certification,
    metal: body.metal ?? current.metal,
    jewellery_type: body.jewelleryType ?? current.jewellery_type,
    birth_month: body.birthMonth === undefined ? current.birth_month : body.birthMonth || null,
    price_cents: body.price === undefined ? current.price_cents : Math.round(Number(body.price) * 100),
    compare_cents: body.compareAt === undefined ? current.compare_cents : body.compareAt === "" || body.compareAt == null ? null : Math.round(Number(body.compareAt) * 100),
    call_for_price: body.callForPrice === undefined ? current.call_for_price : body.callForPrice ? 1 : 0,
    stock: body.stock === undefined ? current.stock : Number(body.stock),
    swatch: body.swatch ?? current.swatch,
    image_url: body.imageUrl === undefined ? current.image_url : body.imageUrl,
    purpose: body.purpose === undefined ? current.purpose : body.purpose,
    sort_order: body.sortOrder === undefined ? current.sort_order : Number(body.sortOrder),
    ...flags(body, ["featured", "bestseller", "limited", "vault", "active"].reduce((acc, key) => {
      acc.push(key);
      return acc;
    }, [])),
  };
  const flagMap = { featured: "is_featured", bestseller: "is_bestseller", limited: "is_limited", vault: "is_vault", active: "active" };
  const mapped = { ...next };
  for (const [from, to] of Object.entries(flagMap)) {
    if (mapped[from] !== undefined && from !== "active") {
      mapped[to] = mapped[from];
      delete mapped[from];
    }
  }
  const keys = Object.keys(mapped);
  run(`UPDATE products SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`, ...keys.map((key) => mapped[key]), id);
  res.json({ product: presentProduct(one(`${PRODUCT_SELECT} WHERE p.id = ?`, id), currencyFrom(req)) });
});

app.delete("/api/admin/products/:id", desk, (req, res) => {
  if (!gate(req, res, "pieces")) return;
  const current = one("SELECT * FROM products WHERE id = ?", Number(req.params.id));
  if (!current || (req.desk.role === "shop" && current.shop_id !== req.desk.shopId)) {
    return res.status(404).json({ error: "Product not found." });
  }
  run("UPDATE products SET active = 0 WHERE id = ?", current.id);
  res.json({ ok: true });
});

const simpleTables = {
  categories: {
    columns: ["parent_id", "slug", "name", "kind", "group_name", "description", "sort_order", "show_in_nav", "active"],
  },
  banners: {
    columns: ["placement", "title", "subtitle", "cta_label", "cta_target", "swatch", "sort_order", "active"],
  },
  content_blocks: {
    columns: ["block_key", "group_name", "title", "body", "cta_label", "cta_target", "sort_order", "active"],
  },
  reviews: {
    columns: ["product_id", "author", "rating", "title", "body", "published"],
  },
  blog_posts: {
    columns: ["slug", "title", "excerpt", "body", "published"],
  },
  purposes: {
    columns: ["slug", "name", "planet", "gemstone", "blurb", "sort_order", "active"],
  },
  rashis: {
    columns: ["name", "english_name", "lord", "gemstone", "start_month", "start_day", "end_month", "end_day", "note", "sort_order"],
  },
  filter_options: {
    columns: ["filter_key", "label", "min_value", "max_value", "match_value", "sort_order", "active"],
  },
  pages: {
    columns: ["slug", "title", "body", "show_in_help", "sort_order", "active"],
  },
  coupons: {
    columns: ["code", "kind", "amount", "min_cents", "active", "expires_at"],
  },
};

function camel(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value,
  ]));
}

app.get("/api/admin/:table", desk, (req, res) => {
  if (req.params.table === "categories" && req.desk.role === "shop") {
    if (!gate(req, res, "pieces")) return;
    return res.json({ items: many("SELECT * FROM categories ORDER BY id DESC").map(camel) });
  }
  if (!gateTable(req, res, req.params.table)) return;
  const shopId = req.desk.role === "shop" ? req.desk.shopId : null;
  if (req.params.table === "orders") {
    const ids = shopId
      ? many(
        `SELECT DISTINCT o.id AS id FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         WHERE p.shop_id = ?
         ORDER BY o.id DESC`,
        shopId,
      )
      : many("SELECT id FROM orders ORDER BY id DESC");
    return res.json({ items: ids.map((row) => orderDetail(row.id)) });
  }
  if (req.params.table === "enquiries") {
    const sql = shopId
      ? "SELECT e.*, p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id = e.product_id WHERE e.shop_id = ? OR p.shop_id = ? ORDER BY e.id DESC"
      : "SELECT e.*, p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id = e.product_id ORDER BY e.id DESC";
    return res.json({ items: many(sql, ...(shopId ? [shopId, shopId] : [])).map(camel) });
  }
  if (req.params.table === "recommendations") {
    return res.json({ items: many("SELECT * FROM recommendation_requests ORDER BY id DESC").map(camel) });
  }
  if (req.params.table === "customers") {
    if (shopId) {
      return adminList(
        res,
        `SELECT DISTINCT u.id, u.name, u.email, u.phone, u.created_at AS createdAt
         FROM users u
         JOIN orders o ON o.user_id = u.id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         WHERE u.role = 'customer' AND p.shop_id = ?
         ORDER BY u.id DESC`,
        shopId,
      );
    }
    return adminList(res, "SELECT id, name, email, phone, created_at AS createdAt FROM users WHERE role = 'customer' ORDER BY id DESC");
  }
  if (req.params.table === "currencies") {
    return res.json({ items: many("SELECT * FROM currencies ORDER BY sort_order").map(camel) });
  }
  if (req.params.table === "reviews" && shopId) {
    return res.json({
      items: many(
        "SELECT r.* FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.shop_id = ? ORDER BY r.id DESC",
        shopId,
      ).map(camel),
    });
  }
  if (req.params.table === "coupons" && shopId) {
    return res.json({ items: many("SELECT * FROM coupons WHERE shop_id = ? ORDER BY id DESC", shopId).map(camel) });
  }
  const spec = simpleTables[req.params.table];
  if (!spec) return res.status(404).json({ error: "Unknown collection." });
  res.json({ items: many(`SELECT * FROM ${req.params.table} ORDER BY id DESC`).map(camel) });
});

app.post("/api/admin/:table", desk, (req, res) => {
  if (!gateTable(req, res, req.params.table)) return;
  if (req.params.table === "currencies") {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code || !req.body.name || !req.body.symbol || req.body.rate == null) {
      return res.status(400).json({ error: "Code, name, symbol, and rate are required." });
    }
    run(
      "INSERT INTO currencies (code, name, symbol, rate, is_default, active, sort_order) VALUES (?, ?, ?, ?, 0, 1, ?)",
      code,
      req.body.name,
      req.body.symbol,
      Number(req.body.rate),
      Number(req.body.sortOrder || 0),
    );
    return res.status(201).json({ item: one("SELECT * FROM currencies WHERE code = ?", code) });
  }
  const spec = simpleTables[req.params.table];
  if (!spec) return res.status(404).json({ error: "Unknown collection." });
  const data = {};
  for (const column of spec.columns) {
    const camelKey = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (req.body[camelKey] !== undefined) data[column] = req.body[camelKey];
    else if (req.body[column] !== undefined) data[column] = req.body[column];
  }
  if (data.slug) data.slug = slugify(data.slug);
  if (req.params.table === "coupons" && req.desk.role === "shop") data.shop_id = req.desk.shopId;
  if (req.params.table === "reviews" && req.desk.role === "shop") {
    const product = one("SELECT id FROM products WHERE id = ? AND shop_id = ?", data.product_id, req.desk.shopId);
    if (!product) return res.status(403).json({ error: "Choose one of your products." });
  }
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: "Nothing to save." });
  const id = run(
    `INSERT INTO ${req.params.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    ...keys.map((key) => data[key]),
  ).id;
  res.status(201).json({ item: camel(one(`SELECT * FROM ${req.params.table} WHERE id = ?`, id)) });
});

app.patch("/api/admin/:table/:id", desk, (req, res) => {
  if (!gateTable(req, res, req.params.table)) return;
  if (!assertShopRow(req, res)) return;
  if (req.params.table === "orders") {
    const id = Number(req.params.id);
    const current = one("SELECT status FROM orders WHERE id = ?", id);
    if (!current) return res.status(404).json({ error: "Order not found." });
    if (req.body.status) {
      const status = String(req.body.status);
      if (!["placed", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Unknown order status." });
      }
      if (status === "cancelled") {
        const result = cancelOrder(id);
        if (result.error) return res.status(result.status).json({ error: result.error });
      } else {
        run("UPDATE orders SET status = ? WHERE id = ?", status, id);
      }
    }
    if (req.body.paymentStatus) {
      const paymentStatus = String(req.body.paymentStatus);
      if (!["unpaid", "due", "paid"].includes(paymentStatus)) {
        return res.status(400).json({ error: "Unknown payment status." });
      }
      run("UPDATE orders SET payment_status = ? WHERE id = ?", paymentStatus, id);
    }
    return res.json({ order: orderDetail(id) });
  }
  if (req.params.table === "enquiries") {
    const status = String(req.body.status || "");
    if (!["new", "contacted", "closed"].includes(status)) return res.status(400).json({ error: "Unknown enquiry status." });
    run("UPDATE enquiries SET status = ? WHERE id = ?", status, Number(req.params.id));
    return res.json({ ok: true });
  }
  if (req.params.table === "currencies") {
    const body = req.body || {};
    if (body.isDefault) run("UPDATE currencies SET is_default = 0");
    run(
      `UPDATE currencies SET name = COALESCE(?, name), symbol = COALESCE(?, symbol), rate = COALESCE(?, rate),
        is_default = COALESCE(?, is_default), active = COALESCE(?, active), sort_order = COALESCE(?, sort_order)
       WHERE code = ?`,
      body.name ?? null,
      body.symbol ?? null,
      body.rate == null ? null : Number(body.rate),
      body.isDefault == null ? null : body.isDefault ? 1 : 0,
      body.active == null ? null : body.active ? 1 : 0,
      body.sortOrder == null ? null : Number(body.sortOrder),
      req.params.id,
    );
    return res.json({ item: one("SELECT * FROM currencies WHERE code = ?", req.params.id) });
  }
  const spec = simpleTables[req.params.table];
  if (!spec) return res.status(404).json({ error: "Unknown collection." });
  const data = {};
  for (const column of spec.columns) {
    const camelKey = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (req.body[camelKey] !== undefined) data[column] = req.body[camelKey];
  }
  if (data.slug) data.slug = slugify(data.slug);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: "Nothing to save." });
  run(
    `UPDATE ${req.params.table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`,
    ...keys.map((key) => data[key]),
    Number(req.params.id),
  );
  res.json({ item: camel(one(`SELECT * FROM ${req.params.table} WHERE id = ?`, Number(req.params.id))) });
});

app.delete("/api/admin/:table/:id", desk, (req, res) => {
  if (!gateTable(req, res, req.params.table)) return;
  if (!assertShopRow(req, res)) return;
  const spec = simpleTables[req.params.table];
  if (!spec) return res.status(404).json({ error: "Unknown collection." });
  run(`DELETE FROM ${req.params.table} WHERE id = ?`, Number(req.params.id));
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || "Something went wrong." });
});

export default app;
