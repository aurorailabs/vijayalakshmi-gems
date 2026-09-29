import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";
import { getToken, setToken } from "./session";

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [currency, setCurrencyState] = useState("USD");

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      const saved = await AsyncStorage.getItem("vg_currency");
      if (saved) setCurrencyState(saved);
      const token = await getToken();
      if (token) {
        try {
          const data = await api("/api/auth/me");
          setUser(data.user);
        } catch {
          await setToken(null);
          setUser(null);
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
    await setToken(token);
    setUser(nextUser);
  }

  async function signOut() {
    await setToken(null);
    setUser(null);
  }

  function updateUser(nextUser) {
    setUser(nextUser);
  }

  return (
    <Store.Provider value={{ ready, user, currency, setCurrency, signIn, signOut, updateUser }}>
      {children}
    </Store.Provider>
  );
}

export function useStore() {
  return useContext(Store);
}
