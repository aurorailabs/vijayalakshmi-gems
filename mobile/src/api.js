import { getToken, setToken } from "./session";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, { method = "GET", body, currency } = {}) {
  const token = await getToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const url = new URL(path, API_URL);
  if (currency) url.searchParams.set("currency", currency);
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    await setToken(null);
    onUnauthorized();
  }
  if (!response.ok) {
    const error = new Error(data.error || "The atelier could not complete that.");
    error.status = response.status;
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
    [/password|at least 8 characters/i, "password"],
    [/enter your name|^name is required|enter the name/i, "name"],
    [/valid email|owner's email|with that email/i, "email"],
    [/email or phone/i, "identifier"],
    [/phone/i, "phone"],
    [/address/i, "line1"],
    [/city/i, "city"],
    [/postal/i, "postal"],
    [/country/i, "country"],
    [/rating/i, "rating"],
    [/few words/i, "body"],
    [/birth date|choose a purpose/i, "birthDate"],
    [/how you will pay/i, "paymentMethod"],
    [/saved address/i, "addressId"],
    [/code is not|code has expired|code is for one shop|minimum for that code/i, "coupon"],
    [/leave a phone|message/i, "message"],
  ];
  for (const [pattern, field] of rules) {
    if (pattern.test(text)) return field;
  }
  return "";
}

export function money(item) {
  if (!item || item.callForPrice || item.price == null) return "Ask the desk";
  const amount = Number(item.price).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${item.symbol}${amount}`;
}
