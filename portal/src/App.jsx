import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";
import { Desk, Enquiries, Orders, Pieces, Recommendations, Resource, Settings, Currencies, Customers } from "./screens.jsx";

const NAV = [
  ["desk", "Desk"],
  ["pieces", "Pieces"],
  ["categories", "Categories"],
  ["banners", "Banners"],
  ["blocks", "Home stories"],
  ["purposes", "Purposes"],
  ["rashis", "Rashi windows"],
  ["filters", "Search filters"],
  ["reviews", "Reviews"],
  ["blog", "Journal"],
  ["pages", "Help pages"],
  ["currencies", "Currencies"],
  ["orders", "Orders"],
  ["enquiries", "Enquiries"],
  ["recommendations", "Advice requests"],
  ["customers", "Customers"],
  ["settings", "Atelier"],
];

export default function App() {
  const [token, setAuth] = useState(getToken());
  const [section, setSection] = useState("desk");
  const [email, setEmail] = useState("admin@vijayalakshmi.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");

  useEffect(() => {
    const onLogout = () => setAuth(null);
    window.addEventListener("vg-logout", onLogout);
    return () => window.removeEventListener("vg-logout", onLogout);
  }, []);

  async function login(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api("/api/auth/login", { method: "POST", body: { email, password } });
      if (result.user.role !== "admin") {
        setError("This desk is for atelier staff.");
        return;
      }
      setToken(result.token);
      setAuth(result.token);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) {
    return (
      <main className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">Configuration desk</p>
          <h1>Vijayalakshmi Gems</h1>
          <p className="muted">What you save here is what the mobile app shows.</p>
          <div className="form">
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            {error ? <p className="error">{error}</p> : null}
            <button className="primary" type="submit">Open the desk</button>
          </div>
          <p className="hint">Local staff login: admin@vijayalakshmi.local / Admin@123</p>
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <strong>Vijayalakshmi</strong>
          <span>Configuration desk</span>
        </div>
        {NAV.map(([id, label]) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>
        ))}
        <button className="signout" onClick={() => { setToken(null); setAuth(null); }}>Sign out</button>
      </aside>
      <main className="main">
        {section === "desk" && <Desk />}
        {section === "pieces" && <Pieces />}
        {section === "categories" && <Categories />}
        {section === "banners" && <Banners />}
        {section === "blocks" && <Blocks />}
        {section === "purposes" && <Purposes />}
        {section === "rashis" && <Rashis />}
        {section === "filters" && <Filters />}
        {section === "reviews" && <Reviews />}
        {section === "blog" && <Journal />}
        {section === "pages" && <Pages />}
        {section === "currencies" && <Currencies />}
        {section === "orders" && <Orders />}
        {section === "enquiries" && <Enquiries />}
        {section === "recommendations" && <Recommendations />}
        {section === "customers" && <Customers />}
        {section === "settings" && <Settings />}
      </main>
    </div>
  );
}

function Categories() {
  return (
    <Resource
      title="Categories"
      intro="Navigation in the app is this tree. A parent such as Gemstones includes every child when a shopper opens it."
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

function Banners() {
  return (
    <Resource
      title="Banners"
      intro="Home slides. A target such as shop:vault, shop:limited, shop:gemstones, or enquire:custom_design opens that place in the app."
      table="banners"
      columns={[["title", "Title"], ["ctaTarget", "Opens"], ["sortOrder", "Sort"]]}
      fields={[
        { key: "title", label: "Title" },
        { key: "subtitle", label: "Subtitle", full: true },
        { key: "placement", label: "Placement", default: "home" },
        { key: "ctaLabel", label: "Button" },
        { key: "ctaTarget", label: "Opens" },
        { key: "swatch", label: "Colour", type: "color" },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

function Blocks() {
  return (
    <Resource
      title="Home stories"
      intro="Certified stones, energizing, and the custom-design steps are edited here and rendered on the phone."
      table="content_blocks"
      columns={[["title", "Title"], ["groupName", "Group"], ["blockKey", "Key"]]}
      fields={[
        { key: "blockKey", label: "Key" },
        { key: "groupName", label: "Group" },
        { key: "title", label: "Title", full: true },
        { key: "body", label: "Body", type: "textarea", full: true },
        { key: "ctaLabel", label: "Button" },
        { key: "ctaTarget", label: "Opens" },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

function Purposes() {
  return (
    <Resource
      title="Purposes"
      intro="The advice screen and the home purpose search use this map. Change the gemstone and the app recommends the new one."
      table="purposes"
      columns={[["name", "Purpose"], ["planet", "Planet"], ["gemstone", "Stone"]]}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "planet", label: "Planet" },
        { key: "gemstone", label: "Gemstone" },
        { key: "blurb", label: "Reason", type: "textarea", full: true },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

function Rashis() {
  return (
    <Resource
      title="Rashi windows"
      intro="Birth dates fall into these windows. The life stone is the gemstone on the matching row."
      table="rashis"
      columns={[["name", "Rashi"], ["englishName", "English"], ["gemstone", "Stone"], ["lord", "Lord"]]}
      fields={[
        { key: "name", label: "Name" },
        { key: "englishName", label: "English name" },
        { key: "lord", label: "Lord" },
        { key: "gemstone", label: "Gemstone" },
        { key: "startMonth", label: "Start month", type: "number" },
        { key: "startDay", label: "Start day", type: "number" },
        { key: "endMonth", label: "End month", type: "number" },
        { key: "endDay", label: "End day", type: "number" },
        { key: "note", label: "Note", type: "textarea", full: true },
        { key: "sortOrder", label: "Sort", type: "number" },
      ]}
    />
  );
}

function Filters() {
  return (
    <Resource
      title="Search filters"
      intro="Carat and price bands are in US dollars. The app converts the labels into the shopper's currency."
      table="filter_options"
      columns={[["filterKey", "Filter"], ["label", "Label"], ["matchValue", "Matches"]]}
      fields={[
        { key: "filterKey", label: "Filter", type: "select", options: ["carat", "price", "treatment", "origin", "shape", "metal", "certification"] },
        { key: "label", label: "Label" },
        { key: "minValue", label: "Minimum", type: "number" },
        { key: "maxValue", label: "Maximum", type: "number" },
        { key: "matchValue", label: "Exact match" },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

function Reviews() {
  return (
    <Resource
      title="Reviews"
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

function Journal() {
  return (
    <Resource
      title="Journal"
      table="blog_posts"
      columns={[["title", "Title"], ["slug", "Slug"]]}
      fields={[
        { key: "title", label: "Title", full: true },
        { key: "slug", label: "Slug" },
        { key: "excerpt", label: "Excerpt", type: "textarea", full: true },
        { key: "body", label: "Article", type: "textarea", full: true },
        { key: "published", label: "Published", type: "check" },
      ]}
    />
  );
}

function Pages() {
  return (
    <Resource
      title="Help pages"
      table="pages"
      columns={[["title", "Title"], ["slug", "Slug"]]}
      fields={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "body", label: "Body", type: "textarea", full: true },
        { key: "showInHelp", label: "Show in the app", type: "check" },
        { key: "sortOrder", label: "Sort", type: "number" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}
