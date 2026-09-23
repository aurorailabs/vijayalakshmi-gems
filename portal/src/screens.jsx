import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

function useItems(path) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    api(path).then((data) => live && setItems(data.items || [])).catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [path, version]);
  return { items, error, reload: () => setVersion((value) => value + 1), setError };
}

function blank(fields) {
  const draft = {};
  for (const field of fields) {
    if (field.default !== undefined) draft[field.key] = field.default;
    else if (field.type === "check") draft[field.key] = field.key === "active" || field.key === "published" || field.key === "showInNav" ? 1 : 0;
    else draft[field.key] = "";
  }
  return draft;
}

function Field({ field, draft, setDraft }) {
  const value = draft[field.key] ?? "";
  if (field.type === "check") {
    return (
      <label className={field.full ? "full" : ""}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={!!Number(value)} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.checked ? 1 : 0 })} />
          {field.label}
        </span>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="full">
        {field.label}
        <textarea value={value} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
      </label>
    );
  }
  if (field.type === "select") {
    const options = field.options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
    return (
      <label>
        {field.label}
        <select value={value ?? ""} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}>
          {options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className={field.full ? "full" : ""}>
      {field.label}
      <input type={field.type === "number" ? "number" : field.type === "color" ? "text" : "text"} value={value} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
    </label>
  );
}

export function Resource({ title, intro, table, columns, fields }) {
  const { items, error, reload, setError } = useItems(`/api/admin/${table}`);
  const resolved = typeof fields === "function" ? fields(items) : fields;
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {};
    for (const field of resolved) {
      const value = draft[field.key];
      if (field.type === "number") body[field.key] = value === "" || value == null ? null : Number(value);
      else if (field.type === "check") body[field.key] = value ? 1 : 0;
      else if (field.key === "parentId") body[field.key] = value ? Number(value) : null;
      else body[field.key] = value;
    }
    try {
      if (draft.id) await api(`/api/admin/${table}/${draft.id}`, { method: "PATCH", body });
      else await api(`/api/admin/${table}`, { method: "POST", body });
      setDraft(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this from the desk?")) return;
    await api(`/api/admin/${table}/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Live in the app</p>
          <h1>{title}</h1>
          {intro ? <p className="muted">{intro}</p> : null}
        </div>
        <button className="primary" onClick={() => setDraft(blank(resolved))}>Add</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th></th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {columns.map(([key]) => <td key={key}>{String(item[key] ?? "")}</td>)}
                <td className="row-actions">
                  <button className="ghost" onClick={() => setDraft(item)}>Edit</button>
                  <button className="danger" onClick={() => remove(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft ? (
        <form className="panel grid-form" onSubmit={save}>
          <h2 className="full">{draft.id ? "Edit" : "Add"}</h2>
          {resolved.map((field) => <Field key={field.key} field={field} draft={draft} setDraft={setDraft} />)}
          <div className="full row-actions">
            <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button className="ghost" type="button" onClick={() => setDraft(null)}>Close</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function Desk() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/admin/stats").then(setStats).catch((err) => setError(err.message));
  }, []);
  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p>Opening the desk…</p>;
  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Vijayalakshmi Gems</p>
          <h1>Desk</h1>
          <p className="muted">Catalog, prices, advice rules, and copy all come from this portal. The phone app does not keep its own list.</p>
        </div>
      </div>
      <div className="cards">
        <article className="card"><span>Pieces on sale</span><b>{stats.products}</b></article>
        <article className="card"><span>Orders</span><b>{stats.orders}</b></article>
        <article className="card"><span>New enquiries</span><b>{stats.enquiries}</b></article>
        <article className="card"><span>Advice requests</span><b>{stats.recommendations}</b></article>
      </div>
      <div className="panel">
        <h2>Short stock</h2>
        <table>
          <tbody>
            {stats.lowStock.map((item) => (
              <tr key={item.id}><td>{item.name}</td><td>{item.sku}</td><td>{item.stock} left</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const emptyPiece = {
  name: "", sku: "", slug: "", kind: "loose", categoryId: "", collectionId: "", summary: "", description: "", benefit: "",
  carat: "", shape: "", origin: "", treatment: "", certification: "", metal: "", jewelleryType: "", birthMonth: "",
  price: "", compareAt: "", stock: 1, swatch: "#7c2432", imageUrl: "", purpose: "", sortOrder: 0,
  callForPrice: 0, featured: 0, bestseller: 0, limited: 0, vault: 0, active: 1,
};

export function Pieces() {
  const { items, error, reload, setError } = useItems("/api/admin/products");
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/admin/categories").then((data) => setCategories(data.items)).catch((err) => setError(err.message));
  }, [setError]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.name} ${item.sku} ${item.origin}`.toLowerCase().includes(needle));
  }, [items, query]);

  function edit(item) {
    setDraft({
      ...item,
      price: item.callForPrice ? "" : (item.priceCents / 100),
      compareAt: item.compareCents ? item.compareCents / 100 : "",
      categoryId: item.categoryId || "",
      collectionId: item.collectionId || "",
      callForPrice: item.callForPrice ? 1 : 0,
      featured: item.featured ? 1 : 0,
      bestseller: item.bestseller ? 1 : 0,
      limited: item.limited ? 1 : 0,
      vault: item.vault ? 1 : 0,
      active: item.active ? 1 : 0,
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...draft,
      categoryId: draft.categoryId ? Number(draft.categoryId) : null,
      collectionId: draft.collectionId ? Number(draft.collectionId) : null,
      price: draft.price === "" ? 0 : Number(draft.price),
      compareAt: draft.compareAt === "" ? null : Number(draft.compareAt),
      carat: draft.carat === "" ? null : Number(draft.carat),
      stock: Number(draft.stock || 0),
      birthMonth: draft.birthMonth ? Number(draft.birthMonth) : null,
      sortOrder: Number(draft.sortOrder || 0),
    };
    try {
      if (draft.id) await api(`/api/admin/products/${draft.id}`, { method: "PATCH", body });
      else await api("/api/admin/products", { method: "POST", body });
      setDraft(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function hide(id) {
    await api(`/api/admin/products/${id}`, { method: "DELETE" });
    reload();
  }

  const leaves = categories.filter((item) => item.parentId);
  const set = (key, value) => setDraft({ ...draft, [key]: value });

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Pieces</h1>
          <p className="muted">Prices are stored in US dollars. The app multiplies by the currency rate.</p>
        </div>
        <div className="toolbar">
          <input placeholder="Search pieces" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="primary" onClick={() => setDraft({ ...emptyPiece })}>Add piece</button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th></th><th>Piece</th><th>SKU</th><th>Price USD</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td><span className="swatch" style={{ background: item.swatch }} /></td>
                <td>{item.name}{item.active ? "" : " (hidden)"}</td>
                <td>{item.sku}</td>
                <td>{item.callForPrice ? "Ask" : item.priceCents / 100}</td>
                <td>{item.stock}</td>
                <td className="row-actions">
                  <button className="ghost" onClick={() => edit(item)}>Edit</button>
                  <button className="danger" onClick={() => hide(item.id)}>Hide</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft ? (
        <form className="panel grid-form" onSubmit={save}>
          <h2 className="full">{draft.id ? draft.name : "New piece"}</h2>
          <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} required /></label>
          <label>SKU<input value={draft.sku} onChange={(e) => set("sku", e.target.value)} /></label>
          <label>Slug<input value={draft.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label>Kind
            <select value={draft.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="loose">Loose stone</option>
              <option value="jewellery">Jewellery</option>
            </select>
          </label>
          <label>Category
            <select value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">None</option>
              {leaves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Collection
            <select value={draft.collectionId} onChange={(e) => set("collectionId", e.target.value)}>
              <option value="">None</option>
              {categories.filter((item) => item.kind === "collection" && item.parentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="full">Summary<input value={draft.summary || ""} onChange={(e) => set("summary", e.target.value)} /></label>
          <label className="full">Description<textarea value={draft.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="full">Why it is worn<textarea value={draft.benefit || ""} onChange={(e) => set("benefit", e.target.value)} /></label>
          <label>Carat<input type="number" step="0.01" value={draft.carat ?? ""} onChange={(e) => set("carat", e.target.value)} /></label>
          <label>Shape<input value={draft.shape || ""} onChange={(e) => set("shape", e.target.value)} /></label>
          <label>Origin<input value={draft.origin || ""} onChange={(e) => set("origin", e.target.value)} /></label>
          <label>Treatment<input value={draft.treatment || ""} onChange={(e) => set("treatment", e.target.value)} /></label>
          <label>Certificate<input value={draft.certification || ""} onChange={(e) => set("certification", e.target.value)} /></label>
          <label>Metal<input value={draft.metal || ""} onChange={(e) => set("metal", e.target.value)} /></label>
          <label>Jewellery type<input value={draft.jewelleryType || ""} onChange={(e) => set("jewelleryType", e.target.value)} /></label>
          <label>Birth month<input type="number" min="1" max="12" value={draft.birthMonth || ""} onChange={(e) => set("birthMonth", e.target.value)} /></label>
          <label>Purpose slug<input value={draft.purpose || ""} onChange={(e) => set("purpose", e.target.value)} /></label>
          <label>Price USD<input type="number" step="0.01" value={draft.price} onChange={(e) => set("price", e.target.value)} /></label>
          <label>Compare-at USD<input type="number" step="0.01" value={draft.compareAt ?? ""} onChange={(e) => set("compareAt", e.target.value)} /></label>
          <label>Stock<input type="number" value={draft.stock} onChange={(e) => set("stock", e.target.value)} /></label>
          <label>Swatch<input value={draft.swatch} onChange={(e) => set("swatch", e.target.value)} /></label>
          <label className="full">Image URL<input value={draft.imageUrl || ""} onChange={(e) => set("imageUrl", e.target.value)} /></label>
          <div className="checks full">
            {[["callForPrice", "Call for price"], ["featured", "Featured"], ["bestseller", "Bestseller"], ["limited", "Limited"], ["vault", "Vault"], ["active", "Active"]].map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={!!Number(draft[key])} onChange={(e) => set(key, e.target.checked ? 1 : 0)} />{label}</label>
            ))}
          </div>
          <div className="full row-actions">
            <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save piece"}</button>
            <button className="ghost" type="button" onClick={() => setDraft(null)}>Close</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function Orders() {
  const { items, error, reload, setError } = useItems("/api/admin/orders");
  async function setStatus(id, status) {
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <div className="top"><div><p className="eyebrow">Commerce</p><h1>Orders</h1></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Ship to</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}<br />{order.items.map((item) => `${item.qty} × ${item.name}`).join(", ")}</td>
                <td>{order.shipName}<br />{order.shipLine1}, {order.shipCity}</td>
                <td>{order.symbol}{order.subtotal}</td>
                <td>
                  <select value={order.status} onChange={(e) => setStatus(order.id, e.target.value)}>
                    {["placed", "confirmed", "shipped", "delivered", "cancelled"].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Enquiries() {
  const { items, error, reload, setError } = useItems("/api/admin/enquiries");
  async function setStatus(id, status) {
    try {
      await api(`/api/admin/enquiries/${id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <div className="top"><div><p className="eyebrow">Desk</p><h1>Enquiries</h1></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>From</th><th>About</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}<br />{item.phone}<br />{item.email}</td>
                <td>{item.type}{item.productName ? ` · ${item.productName}` : ""}</td>
                <td>{item.message}</td>
                <td>
                  <select value={item.status} onChange={(e) => setStatus(item.id, e.target.value)}>
                    {["new", "contacted", "closed"].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Recommendations() {
  const { items, error } = useItems("/api/admin/recommendations");
  return (
    <section>
      <div className="top"><div><p className="eyebrow">Advice</p><h1>Requests</h1><p className="muted">Every advice form on the phone is stored here, including the stone the rules returned.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Person</th><th>Birth</th><th>Result</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}<br />{item.phone}</td>
                <td>{item.birthDate} {item.birthTime}<br />{item.birthPlace}<br />{item.bodyWeightKg ? `${item.bodyWeightKg} kg` : ""}</td>
                <td>{item.rashi} · life {item.lifeStone}<br />purpose {item.purposeStone}<br />{item.suggestedCarat ? `${item.suggestedCarat} ct guide` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Customers() {
  const { items, error } = useItems("/api/admin/customers");
  return (
    <section>
      <div className="top"><div><p className="eyebrow">Accounts</p><h1>Customers</h1></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.phone}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function Currencies() {
  const { items, error, reload, setError } = useItems("/api/admin/currencies");
  const [draft, setDraft] = useState({ code: "", name: "", symbol: "", rate: "" });

  async function save(item) {
    try {
      await api(`/api/admin/currencies/${item.code}`, {
        method: "PATCH",
        body: { name: item.name, symbol: item.symbol, rate: Number(item.rate), isDefault: item.isDefault ? 1 : 0, active: item.active ? 1 : 0 },
      });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function add(event) {
    event.preventDefault();
    try {
      await api("/api/admin/currencies", { method: "POST", body: { ...draft, rate: Number(draft.rate) } });
      setDraft({ code: "", name: "", symbol: "", rate: "" });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="top"><div><p className="eyebrow">Money</p><h1>Currencies</h1><p className="muted">Rate is how many units of this currency equal one US dollar.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel">
        {items.map((item) => (
          <CurrencyRow key={item.code} item={item} onSave={save} />
        ))}
        <form className="grid-form" onSubmit={add} style={{ marginTop: 16 }}>
          <input placeholder="Code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required />
          <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <input placeholder="Symbol" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} required />
          <input placeholder="Rate" type="number" step="0.0001" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} required />
          <button className="primary">Add currency</button>
        </form>
      </div>
    </section>
  );
}

function CurrencyRow({ item, onSave }) {
  const [row, setRow] = useState(item);
  useEffect(() => setRow(item), [item]);
  return (
    <div className="repeat-row" style={{ marginBottom: 8, gridTemplateColumns: "80px 1fr 80px 120px auto auto" }}>
      <strong>{row.code}</strong>
      <input value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} />
      <input value={row.symbol} onChange={(e) => setRow({ ...row, symbol: e.target.value })} />
      <input type="number" step="0.0001" value={row.rate} onChange={(e) => setRow({ ...row, rate: e.target.value })} />
      <label><input type="checkbox" checked={!!row.isDefault} onChange={(e) => setRow({ ...row, isDefault: e.target.checked ? 1 : 0 })} /> Default</label>
      <button className="ghost" type="button" onClick={() => onSave(row)}>Save</button>
    </div>
  );
}

export function Settings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api("/api/admin/settings").then((data) => setSettings(data.settings)).catch((err) => setError(err.message));
  }, []);
  if (!settings) return error ? <p className="error">{error}</p> : <p>Loading atelier…</p>;

  function setPhone(index, key, value) {
    const phones = settings.phones.map((phone, i) => (i === index ? { ...phone, [key]: value } : phone));
    setSettings({ ...settings, phones });
  }
  function setLocation(index, key, value) {
    const locations = settings.locations.map((place, i) => (i === index ? { ...place, [key]: value } : place));
    setSettings({ ...settings, locations });
  }

  async function save(event) {
    event.preventDefault();
    setSaved("");
    try {
      const result = await api("/api/admin/settings", {
        method: "PUT",
        body: { ...settings, carat_divisor: Number(settings.carat_divisor) },
      });
      setSettings(result.settings);
      setSaved("Saved. The app reads this on its next load.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="top"><div><p className="eyebrow">Atelier</p><h1>Settings</h1></div></div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p>{saved}</p> : null}
      <form className="panel grid-form" onSubmit={save}>
        <label>Brand<input value={settings.brand || ""} onChange={(e) => setSettings({ ...settings, brand: e.target.value })} /></label>
        <label>Company<input value={settings.company || ""} onChange={(e) => setSettings({ ...settings, company: e.target.value })} /></label>
        <label className="full">Tagline<textarea value={settings.tagline || ""} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
        <label>Sales hours<input value={settings.sales_hours || ""} onChange={(e) => setSettings({ ...settings, sales_hours: e.target.value })} /></label>
        <label>Support hours<input value={settings.support_hours || ""} onChange={(e) => setSettings({ ...settings, support_hours: e.target.value })} /></label>
        <label>Carat divisor<input type="number" value={settings.carat_divisor} onChange={(e) => setSettings({ ...settings, carat_divisor: e.target.value })} /></label>
        <label className="full">Advice note<textarea value={settings.recommendation_disclaimer || ""} onChange={(e) => setSettings({ ...settings, recommendation_disclaimer: e.target.value })} /></label>
        <div className="full">
          <h3>Phones</h3>
          <div className="repeat">
            {(settings.phones || []).map((phone, index) => (
              <div className="repeat-row" key={index}>
                <input value={phone.label} onChange={(e) => setPhone(index, "label", e.target.value)} />
                <input value={phone.value} onChange={(e) => setPhone(index, "value", e.target.value)} />
                <button className="danger" type="button" onClick={() => setSettings({ ...settings, phones: settings.phones.filter((_, i) => i !== index) })}>Remove</button>
              </div>
            ))}
            <button className="ghost" type="button" onClick={() => setSettings({ ...settings, phones: [...(settings.phones || []), { label: "", value: "" }] })}>Add phone</button>
          </div>
        </div>
        <div className="full">
          <h3>Locations</h3>
          <div className="repeat">
            {(settings.locations || []).map((place, index) => (
              <div className="repeat-row" key={index}>
                <input value={place.city} onChange={(e) => setLocation(index, "city", e.target.value)} />
                <input value={place.lines} onChange={(e) => setLocation(index, "lines", e.target.value)} />
                <button className="danger" type="button" onClick={() => setSettings({ ...settings, locations: settings.locations.filter((_, i) => i !== index) })}>Remove</button>
              </div>
            ))}
            <button className="ghost" type="button" onClick={() => setSettings({ ...settings, locations: [...(settings.locations || []), { city: "", lines: "" }] })}>Add location</button>
          </div>
        </div>
        <button className="primary">Save atelier</button>
      </form>
    </section>
  );
}
