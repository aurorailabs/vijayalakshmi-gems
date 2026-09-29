const KEY = "vg_portal_token";
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("vg-logout"));
  }
  if (!response.ok) {
    const error = new Error(data.error || "The desk could not complete that.");
    error.field = data.field || "";
    throw error;
  }
  return data;
}

export function formProblem(err) {
  const message = err?.message || "";
  return { message, field: err?.field || inferField(message) };
}

function inferField(message) {
  const text = String(message || "");
  const rules = [
    [/email, phone, or password is incorrect/i, ""],
    [/current password/i, "current"],
    [/password/i, "password"],
    [/percentage/i, "commissionPercent"],
    [/choose a role/i, "roleId"],
    [/owner's name/i, "ownerName"],
    [/owner's email|with that email/i, "email"],
    [/owner's phone|with that phone/i, "phone"],
    [/shop name|^name is required|product name/i, "name"],
    [/role name|that role name/i, "name"],
    [/\bsku\b/i, "sku"],
    [/\bslug\b/i, "slug"],
    [/symbol/i, "symbol"],
    [/\brate\b/i, "rate"],
    [/^code\b|currency code/i, "code"],
    [/currency name/i, "name"],
  ];
  for (const [pattern, field] of rules) {
    if (pattern.test(text)) return field;
  }
  return "";
}
