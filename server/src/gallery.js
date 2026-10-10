import { many, run } from "./db.js";

export function saveImages(productId, images) {
  run("DELETE FROM product_images WHERE product_id = ?", productId);
  const rows = Array.isArray(images) ? images.slice(0, 8) : [];
  rows.forEach((image, index) => {
    const label = String(image?.label || "").trim() || (image?.kind === "certificate" ? "Certificate" : `Photo ${index + 1}`);
    const kind = image?.kind === "certificate" || /certificate/i.test(label) ? "certificate" : "photo";
    run(
      "INSERT INTO product_images (product_id, url, label, kind, sort_order) VALUES (?, ?, ?, ?, ?)",
      productId,
      String(image?.url || "").trim(),
      label,
      kind,
      index,
    );
  });
  const cover = rows.map((image) => String(image?.url || "").trim()).find(Boolean) || "";
  run("UPDATE products SET image_url = ? WHERE id = ?", cover, productId);
  return cover;
}

export function imagesFor(productId, fallbackUrl = "") {
  const rows = many(
    "SELECT url, label, kind FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
    productId,
  );
  if (rows.length) {
    return rows.map((row) => ({ url: row.url || "", label: row.label || "", kind: row.kind || "photo" }));
  }
  return fallbackUrl ? [{ url: fallbackUrl, label: "Photo", kind: "photo" }] : [];
}
