import { getSettings, one } from "./db.js";

export const PAYMENTS = [
  { id: "cod", name: "Pay on delivery", detail: "Pay when the piece arrives." },
  { id: "upi", name: "UPI", detail: "The desk sends a UPI request after the order is placed." },
  { id: "card", name: "Card", detail: "The desk sends a payment link. The app does not charge the card." },
];

export const SHIPPING = [
  { id: "standard", name: "Insured post", cents: 2500, freeOverCents: 50000, detail: "Free when the order is $500 or more before tax." },
  { id: "express", name: "Express courier", cents: 7500, freeOverCents: null, detail: "Handed to a courier and fully insured." },
];

export function taxPercent() {
  const value = Number(getSettings().tax_percent);
  return Number.isFinite(value) && value >= 0 ? value : 3;
}

export function shippingMethod(id) {
  return SHIPPING.find((item) => item.id === id) || SHIPPING[0];
}

export function paymentMethod(id) {
  return PAYMENTS.find((item) => item.id === id) || null;
}

export function couponDiscount(code, subtotalCents, shopIds = null) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return { discountCents: 0, code: "", error: "" };
  const row = one("SELECT * FROM coupons WHERE upper(code) = ?", trimmed.toUpperCase());
  if (!row || !row.active) return { discountCents: 0, code: "", error: "That code is not active." };
  if (row.shop_id && shopIds) {
    const ids = [...new Set(shopIds.filter(Boolean))];
    if (ids.length !== 1 || ids[0] !== row.shop_id) {
      return { discountCents: 0, code: "", error: "That code is for one shop. The bag includes another shop." };
    }
  }
  if (row.expires_at && row.expires_at < new Date().toISOString().slice(0, 10)) {
    return { discountCents: 0, code: "", error: "That code has expired." };
  }
  if (subtotalCents < row.min_cents) {
    return { discountCents: 0, code: "", error: "The bag is below the minimum for that code." };
  }
  const raw = row.kind === "percent"
    ? Math.round(subtotalCents * Math.min(100, Number(row.amount)) / 100)
    : Number(row.amount);
  const discountCents = Math.max(0, Math.min(subtotalCents, raw));
  return { discountCents, code: row.code, error: "" };
}

export function quoteTotals({ items, couponCode, shippingId }) {
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const coupon = couponDiscount(couponCode, subtotalCents, items.map((item) => item.shopId));
  const method = shippingMethod(shippingId);
  const taxable = Math.max(0, subtotalCents - coupon.discountCents);
  const shippingCents = method.freeOverCents != null && taxable >= method.freeOverCents ? 0 : method.cents;
  const taxCents = Math.round(taxable * (taxPercent() / 100));
  const totalCents = taxable + shippingCents + taxCents;
  return {
    subtotalCents,
    discountCents: coupon.discountCents,
    shippingCents,
    taxCents,
    totalCents,
    couponCode: coupon.code,
    couponError: coupon.error,
    shippingMethod: method.id,
    shippingName: method.name,
    taxPercent: taxPercent(),
  };
}
