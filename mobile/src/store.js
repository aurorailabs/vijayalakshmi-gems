import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";
import { getToken, setToken } from "./session";

const Store = createContext(null);

export const defaultTheme = {
  background: "#f6f1e8",
  paper: "#fffaf3",
  accent: "#7c2432",
};

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [currency, setCurrencyState] = useState("USD");
  const [theme, setTheme] = useState(defaultTheme);
  const [footer, setFooter] = useState({ home: true, favourite: true, profile: true });

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api("/api/bootstrap").then((data) => {
      if (data.screen?.theme) setTheme({ ...defaultTheme, ...data.screen.theme });
      if (data.screen?.footer) setFooter(data.screen.footer);
    }).catch(() => {});
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
    <Store.Provider value={{ ready, user, currency, setCurrency, theme, setTheme, footer, setFooter, signIn, signOut, updateUser }}>
      {children}
    </Store.Provider>
  );
}

export function useStore() {
  return useContext(Store);
}
