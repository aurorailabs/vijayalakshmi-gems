import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "vg_token";

export async function getToken() {
  try {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(KEY) || null;
    }
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved) return saved;
    const legacy = await AsyncStorage.getItem(KEY);
    if (legacy) {
      await SecureStore.setItemAsync(KEY, legacy);
      await AsyncStorage.removeItem(KEY);
    }
    return legacy;
  } catch {
    return null;
  }
}

export async function setToken(token) {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem(KEY, token);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
  await AsyncStorage.removeItem(KEY);
}
