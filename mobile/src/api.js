import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

export async function api(path, { method = "GET", body, currency } = {}) {
  const token = await AsyncStorage.getItem("vg_token");
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
  if (!response.ok) {
    const error = new Error(data.error || "The atelier could not complete that.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function money(item) {
  if (!item || item.callForPrice || item.price == null) return "Ask the desk";
  const amount = Number(item.price).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${item.symbol}${amount}`;
}
