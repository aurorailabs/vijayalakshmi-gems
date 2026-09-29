import { one } from "./db.js";

export const ASSIGNABLE_MENUS = [
  { id: "desk", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "enquiries", label: "Messages" },
  { id: "pieces", label: "Products" },
  { id: "reviews", label: "Reviews" },
  { id: "coupons", label: "Discounts" },
  { id: "customers", label: "Customers" },
  { id: "settings", label: "Shop details" },
];

export const ASSIGNABLE_FEATURES = [
  { id: "gemstones", label: "Gemstones" },
  { id: "jewellery", label: "Jewellery" },
];

const MENU_IDS = new Set(ASSIGNABLE_MENUS.map((item) => item.id));

export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function cleanMenus(value) {
  const list = Array.isArray(value) ? value : parseJson(value, []);
  return [...new Set(list.filter((id) => MENU_IDS.has(id)))];
}

export function cleanFeatures(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : parseJson(value, {});
  return {
    gemstones: !!raw.gemstones,
    jewellery: !!raw.jewellery,
  };
}

export function deskProfile(user, roleRow) {
  const menus = user.role === "superadmin"
    ? ["dashboard", "shops", "roles"]
    : cleanMenus(roleRow?.menus || user.menus);
  return {
    role: user.role,
    shopId: user.shop_id || null,
    roleId: user.role_id || null,
    roleName: roleRow?.name || "",
    commissionPercent: Number(user.commission_percent) || 0,
    menus,
    features: user.role === "superadmin" ? { gemstones: true, jewellery: true } : cleanFeatures(user.features),
  };
}

export function allows(desk, menu) {
  if (!desk) return false;
  if (desk.role === "superadmin") return true;
  return desk.menus.includes(menu);
}

export function isSuper(desk) {
  return desk?.role === "superadmin";
}

export function kindAllowed(desk, kind) {
  if (!desk || desk.role === "superadmin") return true;
  if (kind === "jewellery") return !!desk.features.jewellery;
  return !!desk.features.gemstones;
}

export function shopOwnsOrder(shopId, orderId) {
  return !!one(
    `SELECT oi.id FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ? AND p.shop_id = ?`,
    orderId,
    shopId,
  );
}

export function shopOwnsReview(shopId, reviewId) {
  return !!one(
    `SELECT r.id FROM reviews r
     JOIN products p ON p.id = r.product_id
     WHERE r.id = ? AND p.shop_id = ?`,
    reviewId,
    shopId,
  );
}

export function shopOwnsCoupon(shopId, couponId) {
  return !!one("SELECT id FROM coupons WHERE id = ? AND shop_id = ?", couponId, shopId);
}

export function shopOwnsEnquiry(shopId, enquiryId) {
  return !!one(
    `SELECT e.id FROM enquiries e
     LEFT JOIN products p ON p.id = e.product_id
     WHERE e.id = ? AND (e.shop_id = ? OR p.shop_id = ?)`,
    enquiryId,
    shopId,
    shopId,
  );
}
