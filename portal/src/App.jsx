import { useEffect, useState } from "react";
import { api, formProblem, getToken, setToken } from "./api.js";
import { Coupons, Customers, Currencies, Dashboard, Desk, Enquiries, Orders, Pieces, Recommendations, Resource, Roles, Settings, ShopProfile, Shops } from "./screens.jsx";

const SHOP_NAV = [
  { group: "Today", items: [
    ["desk", "Overview"],
    ["orders", "Orders"],
    ["enquiries", "Messages"],
  ] },
  { group: "Catalog", items: [
    ["pieces", "Products"],
    ["reviews", "Reviews"],
  ] },
  { group: "Money", items: [
    ["coupons", "Discounts"],
  ] },
  { group: "Shop", items: [
    ["customers", "Customers"],
    ["settings", "Shop details"],
  ] },
];

const SUPER_NAV = [
  { group: "", items: [
    ["dashboard", "Dashboard"],
    ["shops", "Shop users"],
    ["roles", "Roles and permissions"],
  ] },
];

function visibleNav(profile) {
  if (!profile) return [];
  if (profile.role === "superadmin") return SUPER_NAV;
  const allowed = new Set(profile.menus || []);
  return SHOP_NAV
    .map((group) => ({ ...group, items: group.items.filter(([id]) => allowed.has(id)) }))
    .filter((group) => group.items.length);
}

function isDeskUser(user) {
  return user && (user.role === "superadmin" || user.role === "shop");
}

export default function App() {
  const [token, setAuth] = useState(getToken());
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState("desk");
  const [profile, setProfile] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [problem, setProblem] = useState(null);
  const fieldNote = (name) => (problem?.field === name ? problem.message : "");

  useEffect(() => {
    const onLogout = () => {
      setAuth(null);
      setProfile(null);
      setChecking(false);
    };
    window.addEventListener("vg-logout", onLogout);
    return () => window.removeEventListener("vg-logout", onLogout);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const ids = visibleNav(profile).flatMap((group) => group.items.map(([id]) => id));
    if (ids.length && !ids.includes(section)) setSection(ids[0]);
  }, [profile, section]);

  useEffect(() => {
    if (!getToken()) return;
    let live = true;
    api("/api/auth/me")
      .then((data) => {
        if (!live) return;
        if (!isDeskUser(data.user)) {
          setToken(null);
          setAuth(null);
          setProfile(null);
          setError("This desk is for shop staff.");
        } else {
          setProfile(data.user);
          if (data.user.role === "superadmin") setSection("dashboard");
        }
      })
      .catch(() => {
        if (!live) return;
        setAuth(null);
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => { live = false; };
  }, []);

  async function login(event) {
    event.preventDefault();
    const trimmed = identifier.trim();
    const digits = trimmed.replace(/\D/g, "");
    const phoneLength = digits.startsWith("91") && digits.length === 12 ? 10 : digits.replace(/^0/, "").length;
    if (trimmed.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setProblem({ field: "identifier", message: "Enter a valid email." });
      return;
    }
    if (!trimmed.includes("@") && phoneLength < 10) {
      setProblem({ field: "identifier", message: "Enter your email or phone number." });
      return;
    }
    if (!password) {
      setProblem({ field: "password", message: "Enter your password." });
      return;
    }
    setError("");
    setProblem(null);
    setBusy(true);
    try {
      const result = await api("/api/auth/login", { method: "POST", body: { identifier: trimmed, password } });
      if (!isDeskUser(result.user)) {
        setProblem({ field: "", message: "This desk is for shop staff." });
        return;
      }
      setToken(result.token);
      setAuth(result.token);
      setProfile(result.user);
      setSection(result.user.role === "superadmin" ? "dashboard" : "desk");
      setPassword("");
    } catch (err) {
      setProblem(formProblem(err));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="login-wrap">
        <p className="muted">Checking the desk session…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">Shop desk</p>
          <h1>Vijayalakshmi Gems</h1>
          <p className="muted">What you save here is what the mobile app shows.</p>
          <div className="form">
            <label>Email or phone
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
              {fieldNote("identifier") ? <span className="error">{fieldNote("identifier")}</span> : null}
            </label>
            <label>Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              {fieldNote("password") ? <span className="error">{fieldNote("password")}</span> : null}
            </label>
            {(error || (problem?.message && !problem.field)) ? <p className="error">{error || problem.message}</p> : null}
            <button className="primary" type="submit" disabled={busy}>{busy ? "Opening…" : "Open the desk"}</button>
          </div>
          <p className="hint">Super admin: admin@vijayalakshmi.local or 8000001000 / Admin@123</p>
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <strong>Vijayalakshmi</strong>
          <span>{profile?.role === "superadmin" ? "Super admin" : "Shop desk"}</span>
        </div>
        {visibleNav(profile).map((group) => (
          <div key={group.group || "root"}>
            {group.group ? <p className="nav-group">{group.group}</p> : null}
            {group.items.map(([id, label]) => (
              <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>
            ))}
          </div>
        ))}
        <button className="signout" onClick={() => { setToken(null); setAuth(null); setProfile(null); }}>Sign out</button>
      </aside>
      <main className="main">
        {visibleNav(profile).length === 0 ? <p>The super admin has not assigned a menu to this shop yet.</p> : null}
        {section === "desk" && <Desk role={profile?.role} shopName={profile?.shopName} />}
        {section === "pieces" && <Pieces features={profile?.features} />}
        {section === "categories" && <Categories />}
        {section === "reviews" && <Reviews />}
        {section === "currencies" && <Currencies />}
        {section === "orders" && <Orders />}
        {section === "coupons" && <Coupons />}
        {section === "enquiries" && <Enquiries />}
        {section === "recommendations" && <Recommendations />}
        {section === "customers" && <Customers />}
        {section === "dashboard" && <Dashboard />}
        {section === "shops" && <Shops />}
        {section === "roles" && <Roles />}
        {section === "settings" && (profile?.role === "shop" ? <ShopProfile /> : <Settings title="App name" intro="The name, phones, and note on the shared phone app. A shop edits its own name under Shop details." />)}
      </main>
    </div>
  );
}

function Categories() {
  return (
    <Resource
      title="Browse groups"
      intro="The groups every shop shares, such as Gemstones or Rings. A shop picks one of these when it posts a piece."
      table="categories"
      columns={[["name", "Name"], ["kind", "Kind"], ["groupName", "Group"], ["slug", "Slug"]]}
      fields={(items) => [
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "kind", label: "Kind", type: "select", options: ["gemstone", "jewellery", "collection"] },
        { key: "groupName", label: "Group label" },
        { key: "parentId", label: "Parent", type: "select", options: [{ value: "", label: "None" }, ...items.map((item) => ({ value: item.id, label: item.name }))] },
        { key: "description", label: "Description", type: "textarea", full: true },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "showInNav", label: "Show in navigation", type: "check" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

function Reviews() {
  return (
    <Resource
      title="Reviews"
      intro="Ratings buyers leave on a product. Publish a review to show it in the app."
      table="reviews"
      columns={[["author", "Author"], ["rating", "Rating"], ["title", "Title"]]}
      fields={[
        { key: "author", label: "Author" },
        { key: "rating", label: "Rating", type: "number" },
        { key: "title", label: "Title", full: true },
        { key: "body", label: "Review", type: "textarea", full: true },
        { key: "published", label: "Published", type: "check" },
      ]}
    />
  );
}

