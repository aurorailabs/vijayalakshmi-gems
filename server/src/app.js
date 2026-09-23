import cors from "cors";
import express from "express";
import { attachUser, checkPassword, hashPassword, publicUser, requireAdmin, requireUser, signUser } from "./auth.js";
import { db, getSettings, many, one, run, setSetting } from "./db.js";
import { buildRecommendation } from "./recommend.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(attachUser);

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
    collectionId: row.collection_id,
    collectionName: row.collection_name || "",
    collectionSlug: row.collection_slug || "",
    active: row.active == null ? true : !!row.active,
    sortOrder: row.sort_order,
  };
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
         col.name AS collection_name, col.slug AS collection_slug
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories col ON col.id = p.collection_id
`;

function listProducts(query, currency, { includeInactive = false } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push("p.active = 1");
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
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();
  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and a password of at least 6 characters are required." });
  }
  if (one("SELECT id FROM users WHERE email = ?", email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }
  const id = run(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')",
    name,
    email,
    phone,
    hashPassword(password),
  ).id;
  const user = one("SELECT * FROM users WHERE id = ?", id);
  res.status(201).json({ token: signUser(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = one("SELECT * FROM users WHERE email = ?", email);
  if (!user || !checkPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ token: signUser(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireUser, (req, res) => {
  const user = one("SELECT * FROM users WHERE id = ?", req.user.id);
  if (!user) return res.status(401).json({ error: "Sign in required" });
  res.json({ user: publicUser(user) });
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
    reviews: many("SELECT id, author, rating, title, body FROM reviews WHERE published = 1 ORDER BY id DESC LIMIT 8"),
    posts: many("SELECT slug, title, excerpt, created_at AS createdAt FROM blog_posts WHERE published = 1 ORDER BY id DESC LIMIT 4"),
    pages: many("SELECT slug, title FROM pages WHERE active = 1 AND show_in_help = 1 ORDER BY sort_order"),
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
  res.json({ product, related });
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
  const id = run(
    `INSERT INTO enquiries (type, name, phone, email, message, product_id) VALUES (?, ?, ?, ?, ?, ?)`,
    type,
    String(req.body.name || ""),
    phone,
    String(req.body.email || ""),
    message,
    req.body.productId || null,
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

app.post("/api/checkout", requireUser, (req, res) => {
  const currency = currencyFrom(req);
  const cart = cartPayload(req.user.id, currency);
  if (!cart.items.length) return res.status(400).json({ error: "Your bag is empty." });
  const ship = req.body.shipping || {};
  if (!ship.name || !ship.line1 || !ship.city || !ship.country) {
    return res.status(400).json({ error: "Name, address, city, and country are required." });
  }
  const subtotalCents = cart.items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  db.exec("BEGIN");
  try {
    for (const item of cart.items) {
      const fresh = one("SELECT stock, name FROM products WHERE id = ?", item.id);
      if (!fresh || fresh.stock < item.qty) throw fail(400, `${item.name} is no longer available in that quantity.`);
      run("UPDATE products SET stock = stock - ? WHERE id = ?", item.qty, item.id);
    }
    const orderId = run(
      `INSERT INTO orders (user_id, status, currency, subtotal_cents, note, ship_name, ship_phone, ship_line1, ship_city, ship_country)
       VALUES (?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      currency.code,
      subtotalCents,
      String(req.body.note || ""),
      String(ship.name),
      String(ship.phone || ""),
      String(ship.line1),
      String(ship.city),
      String(ship.country),
    ).id;
    for (const item of cart.items) {
      run(
        "INSERT INTO order_items (order_id, product_id, name, sku, qty, unit_cents) VALUES (?, ?, ?, ?, ?, ?)",
        orderId,
        item.id,
        item.name,
        item.sku,
        item.qty,
        item.priceCents,
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
    `SELECT id, user_id AS userId, status, currency, subtotal_cents AS subtotalCents, note,
            ship_name AS shipName, ship_phone AS shipPhone, ship_line1 AS shipLine1,
            ship_city AS shipCity, ship_country AS shipCountry, created_at AS createdAt
     FROM orders WHERE id = ?`,
    id,
  );
  if (!order) return null;
  const cur = one("SELECT * FROM currencies WHERE code = ?", order.currency) || { rate: 1, symbol: "$", code: order.currency };
  order.items = many(
    "SELECT name, sku, qty, unit_cents AS unitCents FROM order_items WHERE order_id = ?",
    id,
  ).map((item) => ({ ...item, unit: money(item.unitCents, cur), line: money(item.unitCents * item.qty, cur) }));
  order.subtotal = money(order.subtotalCents, cur);
  order.symbol = cur.symbol;
  return order;
}

app.get("/api/orders", requireUser, (req, res) => {
  const ids = many("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC", req.user.id);
  res.json({ items: ids.map((row) => orderDetail(row.id)) });
});

app.get("/api/orders/:id", requireUser, (req, res) => {
  const order = orderDetail(Number(req.params.id));
  if (!order || (order.userId !== req.user.id && req.user.role !== "admin")) {
    return res.status(404).json({ error: "Order not found." });
  }
  res.json({ order });
});

function adminList(res, sql, ...params) {
  res.json({ items: many(sql, ...params) });
}

app.get("/api/admin/settings", requireAdmin, (_req, res) => {
  res.json({ settings: getSettings() });
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const allowed = ["brand", "tagline", "company", "sales_hours", "support_hours", "carat_divisor", "recommendation_disclaimer", "phones", "locations"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) setSetting(key, req.body[key]);
  }
  res.json({ settings: getSettings() });
});

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  res.json({
    products: one("SELECT COUNT(*) AS count FROM products WHERE active = 1").count,
    orders: one("SELECT COUNT(*) AS count FROM orders").count,
    enquiries: one("SELECT COUNT(*) AS count FROM enquiries WHERE status = 'new'").count,
    customers: one("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").count,
    recommendations: one("SELECT COUNT(*) AS count FROM recommendation_requests").count,
    lowStock: many("SELECT id, name, sku, stock FROM products WHERE active = 1 AND call_for_price = 0 AND stock <= 1 ORDER BY stock, name"),
  });
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  res.json({ items: listProducts(req.query, currencyFrom(req), { includeInactive: true }) });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });
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
      is_bestseller, is_limited, is_vault, purpose, sort_order, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  ).id;
  const row = one(`${PRODUCT_SELECT} WHERE p.id = ?`, id);
  res.status(201).json({ product: presentProduct(row, currencyFrom(req)) });
});

app.patch("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const current = one("SELECT * FROM products WHERE id = ?", id);
  if (!current) return res.status(404).json({ error: "Product not found." });
  const body = req.body || {};
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

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  run("UPDATE products SET active = 0 WHERE id = ?", Number(req.params.id));
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
};

function camel(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value,
  ]));
}

app.get("/api/admin/:table", requireAdmin, (req, res) => {
  if (req.params.table === "orders") {
    const ids = many("SELECT id FROM orders ORDER BY id DESC");
    return res.json({ items: ids.map((row) => orderDetail(row.id)) });
  }
  if (req.params.table === "enquiries") {
    return res.json({
      items: many("SELECT e.*, p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id = e.product_id ORDER BY e.id DESC").map(camel),
    });
  }
  if (req.params.table === "recommendations") {
    return res.json({ items: many("SELECT * FROM recommendation_requests ORDER BY id DESC").map(camel) });
  }
  if (req.params.table === "customers") {
    return adminList(res, "SELECT id, name, email, phone, created_at AS createdAt FROM users WHERE role = 'customer' ORDER BY id DESC");
  }
  if (req.params.table === "currencies") {
    return res.json({ items: many("SELECT * FROM currencies ORDER BY sort_order").map(camel) });
  }
  const spec = simpleTables[req.params.table];
  if (!spec) return res.status(404).json({ error: "Unknown collection." });
  res.json({ items: many(`SELECT * FROM ${req.params.table} ORDER BY id DESC`).map(camel) });
});

app.post("/api/admin/:table", requireAdmin, (req, res) => {
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
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: "Nothing to save." });
  const id = run(
    `INSERT INTO ${req.params.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    ...keys.map((key) => data[key]),
  ).id;
  res.status(201).json({ item: camel(one(`SELECT * FROM ${req.params.table} WHERE id = ?`, id)) });
});

app.patch("/api/admin/:table/:id", requireAdmin, (req, res) => {
  if (req.params.table === "orders") {
    const status = String(req.body.status || "");
    if (!["placed", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Unknown order status." });
    }
    run("UPDATE orders SET status = ? WHERE id = ?", status, Number(req.params.id));
    return res.json({ order: orderDetail(Number(req.params.id)) });
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

app.delete("/api/admin/:table/:id", requireAdmin, (req, res) => {
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
