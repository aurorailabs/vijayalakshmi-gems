import { useEffect, useState } from "react";
import { api, pictureSrc } from "./api.js";
import { PictureButton } from "./uploads.jsx";

const emptySlide = {
  title: "",
  subtitle: "",
  imageUrl: "",
  ctaLabel: "",
  ctaTarget: "",
  placement: "promotion",
  sortOrder: 1,
  active: 1,
};

export function BannerDesk() {
  const [screen, setScreen] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setScreen(await api("/api/admin/banner-screen"));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function patch(section, key, value) {
    setScreen((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }

  async function saveScreen(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setScreen(await api("/api/admin/banner-screen", {
        method: "PUT",
        body: {
          title: screen.title,
          description: screen.description,
          promotions: { show: screen.promotions.show },
          ads: { show: screen.ads.show },
          gemstones: { show: screen.gemstones.show, title: screen.gemstones.title, description: screen.gemstones.description },
          jewellery: { show: screen.jewellery.show, title: screen.jewellery.title, description: screen.jewellery.description },
          footer: screen.footer,
          theme: screen.theme,
        },
      }));
      setNotice("Saved. The phone shows only the sections that are switched on.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveSlide(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...draft,
      placement: draft.placement === "home" ? "home" : draft.placement === "ad" ? "ad" : "promotion",
      sortOrder: Number(draft.sortOrder || 0),
      active: draft.active ? 1 : 0,
    };
    try {
      if (draft.id) await api(`/api/admin/banners/${draft.id}`, { method: "PATCH", body });
      else await api("/api/admin/banners", { method: "POST", body });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSlide(id) {
    if (!window.confirm("Remove this picture from the phone?")) return;
    await api(`/api/admin/banners/${id}`, { method: "DELETE" });
    await load();
  }

  if (!screen) return <section><p className="muted">Opening the banner setup…</p></section>;

  if (draft) {
    const preview = pictureSrc(draft.imageUrl);
    const kind = draft.placement === "ad" ? "Ad" : "Promotion";
    return (
      <section>
        <button className="ghost back" type="button" onClick={() => setDraft(null)}>Back to banner setup</button>
        <div className="top">
          <div>
            <p className="eyebrow">{kind}</p>
            <h1>{draft.id ? "Edit picture" : "New picture"}</h1>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <form className="panel grid-form" onSubmit={saveSlide}>
          {preview ? <img className="promo-preview full" src={preview} alt="" /> : <div className="promo-missing full">Upload a picture to see it here</div>}
          <label className="full">Title<input value={draft.title || ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="full">Description<input value={draft.subtitle || ""} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
          <div className="full shot-head">
            <label>Picture
              <input value={draft.imageUrl || ""} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Upload a picture, or paste an image address" />
            </label>
            <PictureButton folder="home" label="Upload picture" onError={setError} onUploaded={(urls) => setDraft({ ...draft, imageUrl: urls[0] || "" })} />
          </div>
          <label>Button<input value={draft.ctaLabel || ""} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} /></label>
          <label>Order<input type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} /></label>
          <label className="full">Opens — shop:gemstones or product:a-stone<input value={draft.ctaTarget || ""} onChange={(event) => setDraft({ ...draft, ctaTarget: event.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={!!Number(draft.active)} onChange={(event) => setDraft({ ...draft, active: event.target.checked ? 1 : 0 })} />Show this picture</label>
          <div className="full row-actions">
            <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save picture"}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="top">
        <div>
          <p className="eyebrow">Mobile setup</p>
          <h1>Banner</h1>
          <p className="muted">The preview at the end is the home screen. Switching a section off removes it there straight away.</p>
        </div>
        <button className="primary" type="button" disabled={saving} onClick={saveScreen}>{saving ? "Saving…" : "Save setup"}</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <form className="banner-editor" onSubmit={saveScreen}>
        <ConfigCard kicker="Title" show={screen.title.show} onShow={(value) => patch("title", "show", value)}>
          <label>Title<input value={screen.title.text || ""} onChange={(event) => patch("title", "text", event.target.value)} /></label>
        </ConfigCard>

        <ConfigCard kicker="Description" show={screen.description.show} onShow={(value) => patch("description", "show", value)}>
          <label>Description<textarea value={screen.description.text || ""} onChange={(event) => patch("description", "text", event.target.value)} /></label>
        </ConfigCard>

        <ConfigCard kicker="Promotions" show={screen.promotions.show} onShow={(value) => patch("promotions", "show", value)}>
          <SlideRow
            items={screen.promotions.items || []}
            onAdd={() => setDraft({ ...emptySlide, placement: "promotion", sortOrder: (screen.promotions.items || []).length + 1 })}
            onEdit={setDraft}
            onRemove={removeSlide}
          />
        </ConfigCard>

        <ConfigCard kicker="Ads" show={screen.ads.show} onShow={(value) => patch("ads", "show", value)}>
          <SlideRow
            items={screen.ads.items || []}
            onAdd={() => setDraft({ ...emptySlide, placement: "ad", sortOrder: (screen.ads.items || []).length + 1 })}
            onEdit={setDraft}
            onRemove={removeSlide}
          />
        </ConfigCard>

        <ConfigCard kicker="Gemstones" show={screen.gemstones.show} onShow={(value) => patch("gemstones", "show", value)} />

        <ConfigCard kicker="Jewellery" show={screen.jewellery.show} onShow={(value) => patch("jewellery", "show", value)} />

        <article className="panel banner-block">
          <p className="eyebrow">Footer icons</p>
          <h2>Bottom of the phone</h2>
          <p className="muted">Choose which icons stay on the phone.</p>
          <div className="checks">
            <label><input type="checkbox" checked={!!screen.footer.home} onChange={(event) => patch("footer", "home", event.target.checked)} />Home</label>
            <label><input type="checkbox" checked={!!screen.footer.favourite} onChange={(event) => patch("footer", "favourite", event.target.checked)} />Favourite</label>
            <label><input type="checkbox" checked={!!screen.footer.profile} onChange={(event) => patch("footer", "profile", event.target.checked)} />Profile</label>
          </div>
        </article>

        <article className="panel banner-block">
          <p className="eyebrow">Colour theme</p>
          <h2>Whole app</h2>
          <div className="theme-row">
            <ColorField label="Background" value={screen.theme.background} onChange={(value) => patch("theme", "background", value)} />
            <ColorField label="Cards" value={screen.theme.paper} onChange={(value) => patch("theme", "paper", value)} />
            <ColorField label="Accent" value={screen.theme.accent} onChange={(value) => patch("theme", "accent", value)} />
          </div>
        </article>

        <PhonePreview screen={screen} />
      </form>
    </section>
  );
}

function ConfigCard({ kicker, show, onShow, children }) {
  return (
    <article className={`panel banner-block${show ? "" : " is-off"}`}>
      <div className="shot-head">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2>{show ? "Showing on the phone" : "Hidden from the phone"}</h2>
        </div>
        <label className="check"><input type="checkbox" checked={!!show} onChange={(event) => onShow(event.target.checked)} />Show on the mobile screen</label>
      </div>
      {children}
    </article>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="color-field">{label}
      <span>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#f6f1e8"} onChange={(event) => onChange(event.target.value)} />
        <input value={value || ""} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function SlideRow({ items, onAdd, onEdit, onRemove }) {
  return (
    <>
      <button className="primary" type="button" onClick={onAdd}>Add picture</button>
      <div className="promo-grid">
        {items.map((item) => (
          <article key={item.id} className={item.active ? "promo-card" : "promo-card off"}>
            {item.imageUrl ? <img src={pictureSrc(item.imageUrl)} alt={item.title} /> : <div className="promo-missing">No picture yet</div>}
            <div className="promo-meta">
              <strong>{item.title || "Untitled"}</strong>
              <p>{item.subtitle}</p>
              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => onEdit(item)}>Edit</button>
                <button className="danger" type="button" onClick={() => onRemove(item.id)}>Remove</button>
              </div>
            </div>
          </article>
        ))}
        {!items.length ? <p className="muted">No pictures yet.</p> : null}
      </div>
    </>
  );
}

function piecePrice(item) {
  if (!item || item.callForPrice || item.price == null) return "Ask the desk";
  const amount = Number(item.price).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${item.symbol || ""}${amount}`;
}

function pieceMark(item) {
  if (item.vault) return "By appointment";
  if (item.limited) return "Limited";
  if (item.stock === 1) return "One left";
  if (item.carat) return `${item.carat} ct`;
  return "";
}

function PhonePreview({ screen }) {
  const theme = screen.theme || {};
  const paper = theme.paper || "#fffaf3";
  const accent = theme.accent || "#7c2432";
  const promos = (screen.promotions.items || []).filter((item) => item.active && item.imageUrl);
  const ads = (screen.ads.items || []).filter((item) => item.active && item.imageUrl);
  const icons = [
    screen.footer.home ? "Home" : null,
    screen.footer.favourite ? "Favourite" : null,
    screen.footer.profile ? "Profile" : null,
  ].filter(Boolean);
  return (
    <article className="panel phone-dock">
      <p className="eyebrow">Preview</p>
      <h2>Mobile view</h2>
      <p className="muted">This is the home screen, from the title to the footer icons.</p>
      <div className="phone-device" style={{ background: theme.background || "#f6f1e8" }}>
        <div className="phone-screen">
          {screen.title.show ? <strong className="phone-title">{screen.title.text}</strong> : null}
          {screen.description.show ? <p className="phone-copy">{screen.description.text}</p> : null}
          {screen.promotions.show && promos.length ? (
            <div className="phone-promos">
              {promos.map((item) => (
                <article key={item.id} style={{ background: paper }}>
                  <img src={pictureSrc(item.imageUrl)} alt={item.title || ""} />
                  {item.title ? <strong>{item.title}</strong> : null}
                  {item.subtitle ? <p>{item.subtitle}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
          {screen.ads.show && ads.length ? (
            <div className="phone-ads">
              {ads.map((item) => (
                <article key={item.id} style={{ background: paper }}>
                  <img src={pictureSrc(item.imageUrl)} alt={item.title || ""} />
                  {item.title ? <strong>{item.title}</strong> : null}
                </article>
              ))}
            </div>
          ) : null}
          {screen.gemstones.show ? (
            <PreviewShelf title={screen.gemstones.title} description={screen.gemstones.description} products={screen.gemstones.products} accent={accent} />
          ) : null}
          {screen.jewellery.show ? (
            <PreviewShelf title={screen.jewellery.title} description={screen.jewellery.description} products={screen.jewellery.products} accent={accent} />
          ) : null}
        </div>
        <div className="phone-icons" style={{ background: paper }}>
          {icons.map((label) => <span key={label} style={{ color: accent }}>{label}</span>)}
          {!icons.length ? <span>No footer icons</span> : null}
        </div>
      </div>
    </article>
  );
}

function PreviewShelf({ title, description, products, accent }) {
  return (
    <div className="phone-shelf">
      <div className="phone-shelf-head">
        <div>
          <strong>{title}</strong>
          {description ? <p>{description}</p> : null}
        </div>
        <span style={{ color: accent }}>See all</span>
      </div>
      <div className="phone-cards">
        {(products || []).map((item) => {
          const mark = pieceMark(item);
          const meta = [item.origin, item.certification].filter(Boolean).join(" · ") || item.metal || "";
          return (
            <figure key={item.id} className="phone-gem">
              <div className="phone-gem-photo">
                {item.imageUrl ? <img src={pictureSrc(item.imageUrl)} alt={item.name} /> : null}
                {mark ? <em>{mark}</em> : null}
              </div>
              <figcaption>
                <strong>{item.name}</strong>
                {item.shopName ? <span className="phone-shop">{item.shopName}</span> : null}
                {meta ? <span className="phone-meta">{meta}</span> : null}
                <b style={{ color: accent }}>{piecePrice(item)}</b>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
