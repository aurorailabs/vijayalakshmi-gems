import { useState } from "react";
import { pictureSrc, uploadImage } from "./api.js";

export function PictureButton({ folder, multiple = false, label, onUploaded, onError }) {
  const [busy, setBusy] = useState(false);

  async function onChange(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    onError?.("");
    try {
      const urls = [];
      for (const file of files) urls.push(await uploadImage(file, folder));
      onUploaded(urls);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`primary upload-btn${busy ? " is-busy" : ""}`}>
      {busy ? "Uploading…" : label}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={multiple} disabled={busy} onChange={onChange} />
    </label>
  );
}

export function ShotGallery({ images, onChange, onError }) {
  const shots = images || [];

  function update(index, patch) {
    onChange(shots.map((shot, item) => (item === index ? { ...shot, ...patch } : shot)));
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= shots.length) return;
    const next = [...shots];
    const [shot] = next.splice(index, 1);
    next.splice(target, 0, shot);
    onChange(next);
  }

  return (
    <div className="full shot-list">
      <div className="shot-head">
        <div>
          <p className="eyebrow">Pictures</p>
          <p className="muted">Upload each angle and the certificate. The first picture is the shop card. The phone gallery follows this order. Save the product after uploading.</p>
        </div>
        <PictureButton
          folder="products"
          multiple
          label="Upload pictures"
          onError={onError}
          onUploaded={(urls) => {
            const room = Math.max(0, 8 - shots.length);
            onChange([
              ...shots,
              ...urls.slice(0, room).map((url, index) => ({ url, label: `Photo ${shots.length + index + 1}`, kind: "photo" })),
            ]);
            if (urls.length > room) onError("A product can show 8 pictures. Extra files were left out.");
          }}
        />
      </div>
      {shots.map((shot, index) => {
        const src = pictureSrc(shot.url);
        return (
          <div className="shot-row" key={`${shot.url}-${index}`}>
            {src ? <img src={src} alt={shot.label || "Product picture"} /> : <div className="shot-blank">Certificate card</div>}
            <label>Caption<input value={shot.label || ""} onChange={(event) => update(index, { label: event.target.value })} /></label>
            <label>Kind
              <select value={shot.kind === "certificate" ? "certificate" : "photo"} onChange={(event) => update(index, { kind: event.target.value })}>
                <option value="photo">Photo</option>
                <option value="certificate">Certificate</option>
              </select>
            </label>
            <div className="row-actions">
              <button className="ghost" type="button" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
              <button className="ghost" type="button" onClick={() => move(index, 1)} disabled={index === shots.length - 1}>Down</button>
              <button className="danger" type="button" onClick={() => onChange(shots.filter((_, item) => item !== index))}>Remove</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
