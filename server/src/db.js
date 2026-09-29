import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { phoneKey } from "./auth.js";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "vijayalakshmi.db"));
db.exec("PRAGMA foreign_keys = ON");

function plain(row) {
  if (!row) return null;
  return { ...row };
}

export function one(sql, ...params) {
  return plain(db.prepare(sql).get(...params));
}

export function many(sql, ...params) {
  return db.prepare(sql).all(...params).map((row) => plain(row));
}

export function run(sql, ...params) {
  const result = db.prepare(sql).run(...params);
  return { changes: Number(result.changes), id: Number(result.lastInsertRowid) };
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      phone_key TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      group_name TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      show_in_nav INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      collection_id INTEGER REFERENCES categories(id),
      kind TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      benefit TEXT,
      carat REAL,
      shape TEXT,
      origin TEXT,
      treatment TEXT,
      certification TEXT,
      metal TEXT,
      jewellery_type TEXT,
      birth_month INTEGER,
      price_cents INTEGER NOT NULL DEFAULT 0,
      compare_cents INTEGER,
      call_for_price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      swatch TEXT NOT NULL DEFAULT '#1f4b99',
      image_url TEXT,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_limited INTEGER NOT NULL DEFAULT 0,
      is_vault INTEGER NOT NULL DEFAULT 0,
      purpose TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placement TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      cta_label TEXT,
      cta_target TEXT,
      swatch TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS content_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_key TEXT NOT NULL UNIQUE,
      group_name TEXT,
      title TEXT NOT NULL,
      body TEXT,
      cta_label TEXT,
      cta_target TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT,
      body TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purposes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      planet TEXT NOT NULL,
      gemstone TEXT NOT NULL,
      blurb TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rashis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      english_name TEXT,
      lord TEXT NOT NULL,
      gemstone TEXT NOT NULL,
      start_month INTEGER NOT NULL,
      start_day INTEGER NOT NULL,
      end_month INTEGER NOT NULL,
      end_day INTEGER NOT NULL,
      note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      rate REAL NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS filter_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filter_key TEXT NOT NULL,
      label TEXT NOT NULL,
      min_value REAL,
      max_value REAL,
      match_value TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      show_in_help INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'placed',
      currency TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      note TEXT,
      ship_name TEXT,
      ship_phone TEXT,
      ship_line1 TEXT,
      ship_city TEXT,
      ship_country TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      name TEXT NOT NULL,
      sku TEXT,
      qty INTEGER NOT NULL,
      unit_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      email TEXT,
      message TEXT,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recommendation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT,
      phone TEXT,
      email TEXT,
      birth_date TEXT,
      birth_time TEXT,
      birth_place TEXT,
      body_weight_kg REAL,
      purpose TEXT,
      rashi TEXT,
      life_stone TEXT,
      purpose_stone TEXT,
      suggested_carat REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const bannerColumns = many("PRAGMA table_info(banners)").map((row) => row.name);
  if (!bannerColumns.includes("image_url")) {
    db.exec("ALTER TABLE banners ADD COLUMN image_url TEXT");
  }
  const categoryColumns = many("PRAGMA table_info(categories)").map((row) => row.name);
  if (!categoryColumns.includes("image_url")) {
    db.exec("ALTER TABLE categories ADD COLUMN image_url TEXT");
  }
  const userColumns = many("PRAGMA table_info(users)").map((row) => row.name);
  if (!userColumns.includes("phone_key")) {
    db.exec("ALTER TABLE users ADD COLUMN phone_key TEXT");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users(phone_key) WHERE phone_key IS NOT NULL AND phone_key != ''");
  for (const user of many("SELECT id, phone FROM users WHERE (phone_key IS NULL OR phone_key = '') AND phone IS NOT NULL AND phone != ''")) {
    const key = phoneKey(user.phone);
    if (!key || one("SELECT id FROM users WHERE phone_key = ? AND id != ?", key, user.id)) continue;
    run("UPDATE users SET phone_key = ? WHERE id = ?", key, user.id);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storage TEXT NOT NULL,
      object_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes BLOB,
      byte_size INTEGER NOT NULL DEFAULT 0,
      public_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      state TEXT,
      postal_code TEXT,
      country TEXT NOT NULL DEFAULT 'India',
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      min_cents INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );
  `);
  const reviewColumns = many("PRAGMA table_info(reviews)").map((row) => row.name);
  if (!reviewColumns.includes("user_id")) db.exec("ALTER TABLE reviews ADD COLUMN user_id INTEGER REFERENCES users(id)");
  if (!reviewColumns.includes("verified")) db.exec("ALTER TABLE reviews ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product ON reviews(user_id, product_id) WHERE user_id IS NOT NULL");
  const orderColumns = many("PRAGMA table_info(orders)").map((row) => row.name);
  const orderAdds = [
    ["discount_cents", "INTEGER NOT NULL DEFAULT 0"],
    ["shipping_cents", "INTEGER NOT NULL DEFAULT 0"],
    ["tax_cents", "INTEGER NOT NULL DEFAULT 0"],
    ["total_cents", "INTEGER"],
    ["coupon_code", "TEXT"],
    ["shipping_method", "TEXT"],
    ["payment_method", "TEXT"],
    ["payment_status", "TEXT NOT NULL DEFAULT 'unpaid'"],
    ["ship_line2", "TEXT"],
    ["ship_state", "TEXT"],
    ["ship_postal", "TEXT"],
  ];
  for (const [name, type] of orderAdds) {
    if (!orderColumns.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
  }
  if (!one("SELECT id FROM coupons LIMIT 1")) {
    run("INSERT INTO coupons (code, kind, amount, min_cents) VALUES ('WELCOME10', 'percent', 10, 0)");
    run("INSERT INTO coupons (code, kind, amount, min_cents) VALUES ('GEM50', 'amount', 5000, 20000)");
  }
  if (getSettings().tax_percent === undefined) setSetting("tax_percent", 3);
  if (getSettings().feature_oracle_cloud === undefined) setSetting("feature_oracle_cloud", false);
  if (getSettings().feature_aws_cloud === undefined) setSetting("feature_aws_cloud", false);

  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      city TEXT,
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const deskUserColumns = many("PRAGMA table_info(users)").map((row) => row.name);
  if (!deskUserColumns.includes("shop_id")) db.exec("ALTER TABLE users ADD COLUMN shop_id INTEGER REFERENCES shops(id)");
  if (!deskUserColumns.includes("menus")) db.exec("ALTER TABLE users ADD COLUMN menus TEXT");
  if (!deskUserColumns.includes("features")) db.exec("ALTER TABLE users ADD COLUMN features TEXT");
  const productColumns = many("PRAGMA table_info(products)").map((row) => row.name);
  if (!productColumns.includes("shop_id")) db.exec("ALTER TABLE products ADD COLUMN shop_id INTEGER REFERENCES shops(id)");
  const couponColumns = many("PRAGMA table_info(coupons)").map((row) => row.name);
  if (!couponColumns.includes("shop_id")) db.exec("ALTER TABLE coupons ADD COLUMN shop_id INTEGER REFERENCES shops(id)");
  const enquiryColumns = many("PRAGMA table_info(enquiries)").map((row) => row.name);
  if (!enquiryColumns.includes("shop_id")) db.exec("ALTER TABLE enquiries ADD COLUMN shop_id INTEGER REFERENCES shops(id)");
  run("UPDATE users SET role = 'superadmin' WHERE role = 'admin'");
  if (!one("SELECT id FROM shops LIMIT 1")) {
    run(
      "INSERT INTO shops (name, slug, city, phone) VALUES (?, ?, ?, ?)",
      "Vijayalakshmi Gems",
      "vijayalakshmi-gems",
      "Bengaluru",
      "+91 80 0000 1001",
    );
  }
  const homeShop = one("SELECT id FROM shops ORDER BY id LIMIT 1");
  if (homeShop) run("UPDATE products SET shop_id = ? WHERE shop_id IS NULL", homeShop.id);
  run(`UPDATE enquiries SET shop_id = (
    SELECT shop_id FROM products WHERE products.id = enquiries.product_id
  ) WHERE shop_id IS NULL AND product_id IS NOT NULL`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      menus TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const roleUserColumns = many("PRAGMA table_info(users)").map((row) => row.name);
  if (!roleUserColumns.includes("role_id")) db.exec("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)");
  if (!roleUserColumns.includes("commission_percent")) db.exec("ALTER TABLE users ADD COLUMN commission_percent REAL NOT NULL DEFAULT 0");
  if (!one("SELECT id FROM roles LIMIT 1")) {
    run(
      "INSERT INTO roles (name, menus) VALUES (?, ?)",
      "Shop keeper",
      JSON.stringify(["desk", "orders", "enquiries", "pieces", "reviews", "coupons", "customers", "settings"]),
    );
  }
  const defaultRole = one("SELECT id FROM roles ORDER BY id LIMIT 1");
  if (defaultRole) run("UPDATE users SET role_id = ? WHERE role = 'shop' AND role_id IS NULL", defaultRole.id);
}

export function getSettings() {
  const rows = many("SELECT key, value FROM settings");
  const settings = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export function setSetting(key, value) {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    JSON.stringify(value),
  );
}
