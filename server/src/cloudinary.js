import { createHash } from "node:crypto";

const FOLDERS = {
  home: "vijayalakshmi/home",
  products: "vijayalakshmi/products",
};

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function imageFromDataUrl(data, filename = "image.jpg") {
  const text = String(data || "");
  const match = text.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  const mime = (match ? match[1] : "").toLowerCase();
  const encoded = (match ? match[2] : text).replace(/\s/g, "");
  if (!TYPES[mime]) return { error: "Use a JPG, PNG, WEBP, or GIF picture." };
  if (!encoded || !/^[a-z0-9+/=]+$/i.test(encoded)) return { error: "That picture could not be read." };
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length) return { error: "That picture is empty." };
  if (buffer.length > 8 * 1024 * 1024) return { error: "Use a picture under 8 MB." };
  const safe = String(filename || "image").replace(/[^\w.-]+/g, "-").slice(0, 80);
  return { buffer, filename: safe.includes(".") ? safe : `${safe}.${TYPES[mime]}` };
}

export async function uploadToCloudinary(buffer, { filename, folder }) {
  if (!cloudinaryReady()) {
    const error = new Error("Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server, then restart the API.");
    error.status = 503;
    throw error;
  }
  const cloudFolder = FOLDERS[folder];
  if (!cloudFolder) {
    const error = new Error("Choose a home or product picture.");
    error.status = 400;
    throw error;
  }
  const timestamp = Math.round(Date.now() / 1000);
  const signed = `folder=${cloudFolder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(signed + process.env.CLOUDINARY_API_SECRET).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([buffer]), filename || "image.jpg");
  form.append("api_key", process.env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("folder", cloudFolder);
  form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    const error = new Error(payload?.error?.message || "Cloudinary could not store that picture.");
    error.status = 502;
    throw error;
  }
  return { url: payload.secure_url, publicId: payload.public_id || "" };
}
