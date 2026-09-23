import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [currency, setCurrencyState] = useState("USD");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("vg_currency");
      if (saved) setCurrencyState(saved);
      const token = await AsyncStorage.getItem("vg_token");
      if (token) {
        try {
          const data = await api("/api/auth/me");
          setUser(data.user);
        } catch {
          await AsyncStorage.removeItem("vg_token");
        }
      }
      setReady(true);
    })();
  }, []);

  async function setCurrency(code) {
    setCurrencyState(code);
    await AsyncStorage.setItem("vg_currency", code);
  }

  async function signIn(token, nextUser) {
    await AsyncStorage.setItem("vg_token", token);
    setUser(nextUser);
  }

  async function signOut() {
    await AsyncStorage.removeItem("vg_token");
    setUser(null);
  }

  return (
    <Store.Provider value={{ ready, user, currency, setCurrency, signIn, signOut }}>
      {children}
    </Store.Provider>
  );
}

export function useStore() {
  return useContext(Store);
}
