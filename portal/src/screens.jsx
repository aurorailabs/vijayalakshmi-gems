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

  if (draft) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to {title.toLowerCase()}</button>
        <div className="top">
          <div>
            <p className="eyebrow">{title}</p>
            <h1>{draft.id ? "Edit" : "Add"}</h1>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={save}>
          {resolved.map((field) => <Field key={field.key} field={field} draft={draft} setDraft={setDraft} />)}
          <div className="full row-actions">
            <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </section>
    );
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
    </section>
  );
}

export function Desk({ role, shopName }) {
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
          <h1>Overview</h1>
          <p className="muted">{role === "shop" ? `${shopName || "Your shop"} on the shared app. Buyers see your stones and jewellery next to every other shop.` : "Every shop on the shared app. You decide who can sign in, and which menus they can use."}</p>
        </div>
      </div>
      <div className="cards">
        {stats.shops != null ? <article className="card"><span>Shops</span><b>{stats.shops}</b></article> : null}
        <article className="card"><span>Products on sale</span><b>{stats.products}</b></article>
        <article className="card"><span>Orders</span><b>{stats.orders}</b></article>
        <article className="card"><span>New messages</span><b>{stats.enquiries}</b></article>
        {stats.recommendations != null ? <article className="card"><span>Stone advice</span><b>{stats.recommendations}</b></article> : null}
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

export function Pieces({ features = { gemstones: true, jewellery: true } }) {
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

  if (draft) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to products</button>
        <div className="top">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>{draft.id ? draft.name || "Edit product" : "New product"}</h1>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={save}>
          <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} required /></label>
          <label>SKU<input value={draft.sku} onChange={(e) => set("sku", e.target.value)} /></label>
          <label>Slug<input value={draft.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label>Kind
            <select value={draft.kind} onChange={(e) => set("kind", e.target.value)}>
              {features.gemstones ? <option value="loose">Loose stone</option> : null}
              {features.jewellery ? <option value="jewellery">Jewellery</option> : null}
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
            <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save product"}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Products</h1>
          <p className="muted">Stones and jewellery for sale. The price is in US dollars. The app converts it for the shopper.</p>
        </div>
        <div className="toolbar">
          <input placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="primary" onClick={() => setDraft({ ...emptyPiece, kind: features.jewellery && !features.gemstones ? "jewellery" : "loose" })}>Add product</button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th></th><th>Product</th><th>SKU</th><th>Price USD</th><th>Stock</th><th></th></tr></thead>
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
    </section>
  );
}

export function Orders() {
  const { items, error, reload, setError } = useItems("/api/admin/orders");
  const [openId, setOpenId] = useState(null);
  const order = items.find((item) => item.id === openId);
  async function setStatus(id, status) {
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  async function setPayment(id, paymentStatus) {
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: { paymentStatus } });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  if (order) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setOpenId(null)}>Back to orders</button>
        <div className="top"><div><p className="eyebrow">Commerce</p><h1>Order #{order.id}</h1></div></div>
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          <p>{order.items.map((item) => `${item.qty} × ${item.name}`).join(", ")}</p>
          <p>{order.shipName}<br />{[order.shipLine1, order.shipCity, order.shipPostal, order.shipCountry].filter(Boolean).join(", ")}</p>
          <p>Total {order.symbol}{order.total}{order.couponCode ? ` · ${order.couponCode}` : ""}</p>
          <div className="grid-form">
            <label>Status
              <select value={order.status} onChange={(e) => setStatus(order.id, e.target.value)}>
                {["placed", "confirmed", "shipped", "delivered", "cancelled"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label>Payment
              <select value={order.paymentStatus || "unpaid"} onChange={(e) => setPayment(order.id, e.target.value)}>
                {["unpaid", "due", "paid"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="top"><div><p className="eyebrow">Today</p><h1>Orders</h1><p className="muted">Open an order to update shipping and whether it is paid.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Ship to</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>#{item.id}<br />{item.items.map((line) => `${line.qty} × ${line.name}`).join(", ")}</td>
                <td>{item.shipName}<br />{item.shipLine1}, {item.shipCity}</td>
                <td>{item.symbol}{item.total}{item.couponCode ? <><br />{item.couponCode}</> : null}</td>
                <td>{item.status}<br />{item.paymentStatus}</td>
                <td><button className="ghost" onClick={() => setOpenId(item.id)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Coupons() {
  return (
    <Resource
      title="Discounts"
      intro="A code the shopper types at checkout. Percent is a number from 1 to 100. A fixed amount is US cents, so 5000 is $50."
      table="coupons"
      columns={[["code", "Code"], ["kind", "Kind"], ["amount", "Amount"], ["minCents", "Minimum cents"], ["active", "Active"]]}
      fields={[
        { key: "code", label: "Code" },
        { key: "kind", label: "Kind", type: "select", options: ["percent", "amount"] },
        { key: "amount", label: "Amount", type: "number" },
        { key: "minCents", label: "Minimum, US cents", type: "number" },
        { key: "expiresAt", label: "Expires (YYYY-MM-DD)" },
        { key: "active", label: "Active", type: "check" },
      ]}
    />
  );
}

export function Enquiries() {
  const { items, error, reload, setError } = useItems("/api/admin/enquiries");
  const [openId, setOpenId] = useState(null);
  const enquiry = items.find((item) => item.id === openId);
  async function setStatus(id, status) {
    try {
      await api(`/api/admin/enquiries/${id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  if (enquiry) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setOpenId(null)}>Back to messages</button>
        <div className="top"><div><p className="eyebrow">Today</p><h1>{enquiry.name || "Message"}</h1></div></div>
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          <p>{enquiry.phone}<br />{enquiry.email}</p>
          <p>{enquiry.type}{enquiry.productName ? ` · ${enquiry.productName}` : ""}</p>
          <p>{enquiry.message}</p>
          <label>Status
            <select value={enquiry.status} onChange={(e) => setStatus(enquiry.id, e.target.value)}>
              {["new", "contacted", "closed"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="top"><div><p className="eyebrow">Today</p><h1>Messages</h1><p className="muted">People who wrote from the app. Mark each one contacted or closed.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>From</th><th>About</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}<br />{item.phone}</td>
                <td>{item.type}{item.productName ? ` · ${item.productName}` : ""}</td>
                <td>{item.status}</td>
                <td><button className="ghost" onClick={() => setOpenId(item.id)}>Open</button></td>
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
      <div className="top"><div><p className="eyebrow">Shared app</p><h1>Advice rules</h1><p className="muted">Birth details someone sent, and the stone the shared app suggested.</p></div></div>
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
      <div className="top"><div><p className="eyebrow">Shop</p><h1>Customers</h1><p className="muted">People with an account: name, email, and phone.</p></div></div>
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
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (draft.existing) {
        await api(`/api/admin/currencies/${draft.code}`, {
          method: "PATCH",
          body: { name: draft.name, symbol: draft.symbol, rate: Number(draft.rate), isDefault: draft.isDefault ? 1 : 0, active: draft.active ? 1 : 0 },
        });
      } else {
        await api("/api/admin/currencies", { method: "POST", body: { ...draft, rate: Number(draft.rate) } });
      }
      setDraft(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (draft) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to currencies</button>
        <div className="top"><div><p className="eyebrow">Money</p><h1>{draft.existing ? draft.code : "New currency"}</h1></div></div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={save}>
          <label>Code<input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required disabled={draft.existing} /></label>
          <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label>Symbol<input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} required /></label>
          <label>Rate<input type="number" step="0.0001" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} required /></label>
          {draft.existing ? <label><input type="checkbox" checked={!!draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked ? 1 : 0 })} /> Default</label> : null}
          <div className="full"><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Shared app</p>
          <h1>Price rates</h1>
          <p className="muted">How many of this currency equal one US dollar. The shop multiplies the dollar price by this rate.</p>
        </div>
        <button className="primary" onClick={() => setDraft({ code: "", name: "", symbol: "", rate: "", existing: false })}>Add</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Rate</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code}>
                <td>{item.code}{item.isDefault ? " · default" : ""}</td>
                <td>{item.name}</td>
                <td>{item.symbol}</td>
                <td>{item.rate}</td>
                <td><button className="ghost" onClick={() => setDraft({ ...item, existing: true })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Settings({ title = "App details", intro = "The shared app name, phones, and the note under stone advice." }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api("/api/admin/settings").then((data) => setSettings(data.settings)).catch((err) => setError(err.message));
  }, []);
  if (!settings) return error ? <p className="error">{error}</p> : <p>Loading shop details…</p>;

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
      <div className="top"><div><p className="eyebrow">Platform</p><h1>{title}</h1><p className="muted">{intro}</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p>{saved}</p> : null}
      <form className="panel grid-form" onSubmit={save}>
        <label>Brand<input value={settings.brand || ""} onChange={(e) => setSettings({ ...settings, brand: e.target.value })} /></label>
        <label>Company<input value={settings.company || ""} onChange={(e) => setSettings({ ...settings, company: e.target.value })} /></label>
        <label className="full">Tagline<textarea value={settings.tagline || ""} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
        <label>Sales hours<input value={settings.sales_hours || ""} onChange={(e) => setSettings({ ...settings, sales_hours: e.target.value })} /></label>
        <label>Support hours<input value={settings.support_hours || ""} onChange={(e) => setSettings({ ...settings, support_hours: e.target.value })} /></label>
        <label>Carat divisor<input type="number" value={settings.carat_divisor} onChange={(e) => setSettings({ ...settings, carat_divisor: e.target.value })} /></label>
        <label className="full">Note under stone advice<textarea value={settings.recommendation_disclaimer || ""} onChange={(e) => setSettings({ ...settings, recommendation_disclaimer: e.target.value })} /></label>
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
        <button className="primary">Save</button>
      </form>
    </section>
  );
}

const emptyShop = {
  name: "",
  city: "",
  shopPhone: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  roleId: "",
  commissionPercent: "10",
  features: { gemstones: true, jewellery: true },
  active: true,
};

export function Shops() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [featureList, setFeatureList] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api("/api/admin/shops")
      .then((data) => {
        setItems(data.items || []);
        setRoles(data.roles || []);
        setFeatureList(data.features || []);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: draft.name,
        city: draft.city,
        shopPhone: draft.shopPhone,
        ownerName: draft.ownerName,
        email: draft.email,
        phone: draft.phone,
        password: draft.password,
        roleId: draft.roleId,
        commissionPercent: Number(draft.commissionPercent),
        features: draft.features,
        active: draft.active,
      };
      if (draft.id) await api(`/api/admin/shops/${draft.id}`, { method: "PATCH", body });
      else await api("/api/admin/shops", { method: "POST", body });
      setDraft(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (draft) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to shop users</button>
        <div className="top">
          <div>
            <p className="eyebrow">Shops</p>
            <h1>{draft.id ? draft.name || "Edit shop user" : "New shop user"}</h1>
            <p className="muted">Choose the role for their menus, and the percentage of their sales that is paid to you.</p>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={save}>
          <label>Shop name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label>City<input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></label>
          <label>Shop phone<input value={draft.shopPhone} onChange={(e) => setDraft({ ...draft, shopPhone: e.target.value })} /></label>
          {draft.id ? <label><input type="checkbox" checked={!!draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Show in the app</label> : null}
          <h3 className="full">Owner</h3>
          <label>Name<input value={draft.ownerName} onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })} required /></label>
          <label>Email<input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required /></label>
          <label>Phone<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} required /></label>
          <label>Password<input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder={draft.id ? "Leave blank to keep" : ""} required={!draft.id} /></label>
          <label>Role
            <select value={draft.roleId} onChange={(e) => setDraft({ ...draft, roleId: e.target.value })} required>
              <option value="">Choose a role</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <label>Your percentage
            <input type="number" min="0" max="100" step="0.1" value={draft.commissionPercent} onChange={(e) => setDraft({ ...draft, commissionPercent: e.target.value })} required />
          </label>
          {!roles.length ? <p className="full error">Create a role under Roles and permissions before adding a shop user.</p> : null}
          <div className="full">
            <h3>What they can post</h3>
            <div className="checks">
              {featureList.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={!!draft.features[item.id]} onChange={(e) => setDraft({ ...draft, features: { ...draft.features, [item.id]: e.target.checked } })} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="full"><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save shop user"}</button></div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Shops</p>
          <h1>Shop users</h1>
          <p className="muted">Create the login for a shop. The role decides which menus they see. The percentage is your share of their sales.</p>
        </div>
        <button className="primary" onClick={() => setDraft({ ...emptyShop, features: { ...emptyShop.features } })}>Add shop user</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Shop</th><th>Owner</th><th>Role</th><th>Your %</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}{item.active ? "" : " (hidden)"}<br />{item.city}</td>
                <td>{item.owner ? <>{item.owner.name}<br />{item.owner.email}</> : "No owner yet"}</td>
                <td>{item.roleName || "No role"}</td>
                <td>{item.commissionPercent}%</td>
                <td><button className="ghost" onClick={() => setDraft({
                  id: item.id,
                  name: item.name,
                  city: item.city,
                  shopPhone: item.phone,
                  ownerName: item.owner?.name || "",
                  email: item.owner?.email || "",
                  phone: item.owner?.phone || "",
                  password: "",
                  roleId: item.roleId || "",
                  commissionPercent: item.commissionPercent,
                  features: item.features,
                  active: item.active,
                })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ShopProfile() {
  const [shop, setShop] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api("/api/admin/shop").then((data) => setShop(data.shop)).catch((err) => setError(err.message));
  }, []);
  if (!shop) return error ? <p className="error">{error}</p> : <p>Loading shop details…</p>;

  async function save(event) {
    event.preventDefault();
    setSaved("");
    setError("");
    try {
      const result = await api("/api/admin/shop", { method: "PUT", body: shop });
      setShop(result.shop);
      setSaved("Saved. The app shows this name on your pieces.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Shop</p>
          <h1>Shop details</h1>
          <p className="muted">The name buyers see on your stones and jewellery in the shared app.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p>{saved}</p> : null}
      <form className="panel grid-form" onSubmit={save}>
        <label>Shop name<input value={shop.name || ""} onChange={(e) => setShop({ ...shop, name: e.target.value })} required /></label>
        <label>City<input value={shop.city || ""} onChange={(e) => setShop({ ...shop, city: e.target.value })} /></label>
        <label>Phone<input value={shop.phone || ""} onChange={(e) => setShop({ ...shop, phone: e.target.value })} /></label>
        <div className="full"><button className="primary">Save</button></div>
      </form>
    </section>
  );
}

export function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/admin/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Opening the dashboard…</p>;
  const money = (value) => `${data.symbol}${Number(value || 0).toLocaleString("en-IN")}`;
  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>Dashboard</h1>
          <p className="muted">Each shop’s sales, and the percentage of those sales that is paid to you.</p>
        </div>
      </div>
      <div className="cards">
        <article className="card"><span>Shops</span><b>{data.shops.length}</b></article>
        <article className="card"><span>Shop sales</span><b>{money(data.earned)}</b></article>
        <article className="card"><span>Your share</span><b>{money(data.share)}</b></article>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Shop</th><th>Owner</th><th>Earned</th><th>Your %</th><th>Paid to you</th></tr></thead>
          <tbody>
            {data.shops.map((shop) => (
              <tr key={shop.shopId}>
                <td>{shop.shopName}</td>
                <td>{shop.ownerName || "No owner"}{shop.ownerEmail ? <><br />{shop.ownerEmail}</> : null}</td>
                <td>{money(shop.earned)}</td>
                <td>{shop.commissionPercent}%</td>
                <td>{money(shop.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const emptyRole = { name: "", menus: [] };

export function Roles() {
  const [items, setItems] = useState([]);
  const [menus, setMenus] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api("/api/admin/roles")
      .then((data) => {
        setItems(data.items || []);
        setMenus(data.menus || []);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  function toggleMenu(id) {
    const next = draft.menus.includes(id) ? draft.menus.filter((item) => item !== id) : [...draft.menus, id];
    setDraft({ ...draft, menus: next });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { name: draft.name, menus: draft.menus };
      if (draft.id) await api(`/api/admin/roles/${draft.id}`, { method: "PATCH", body });
      else await api("/api/admin/roles", { method: "POST", body });
      setDraft(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setError("");
    try {
      await api(`/api/admin/roles/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (draft) {
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to roles</button>
        <div className="top">
          <div>
            <p className="eyebrow">Permissions</p>
            <h1>{draft.id ? draft.name || "Edit role" : "New role"}</h1>
            <p className="muted">Tick the menus this role can see. Every shop user with this role sees the same menus.</p>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={save}>
          <label className="full">Role name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <div className="full checks">
            {menus.map((item) => (
              <label key={item.id}><input type="checkbox" checked={draft.menus.includes(item.id)} onChange={() => toggleMenu(item.id)} />{item.label}</label>
            ))}
          </div>
          <div className="full"><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save role"}</button></div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Permissions</p>
          <h1>Roles and permissions</h1>
          <p className="muted">A role is the set of menus a shop user is allowed to open.</p>
        </div>
        <button className="primary" onClick={() => setDraft({ ...emptyRole, menus: [] })}>Add role</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Menus</th><th>Shop users</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.menus.length}</td>
                <td>{item.users}</td>
                <td className="row-actions">
                  <button className="ghost" onClick={() => setDraft({ id: item.id, name: item.name, menus: item.menus })}>Edit</button>
                  <button className="danger" onClick={() => remove(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
