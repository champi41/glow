// src/pages/admin/BusinessProfilePage.jsx

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Check, Camera, Image as ImageIcon, Sun, Moon } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./BusinessProfilePage.css";

const CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "djghs9u2k";
const DESC_MAX = 200;
const DEFAULT_THEME = {
  mode: "light",
  accent: "#c17b5c",
};

const LIGHT_ACCENTS = [
  "#c17b5c",
  "#2d6a4f",
  "#1d3557",
  "#6b4226",
  "#7b2d8b",
  "#b5451b",
  "#1a6b7c",
  "#8b5e3c",
];

const DARK_ACCENTS = [
  "#f4a261",
  "#52b788",
  "#74b3ce",
  "#e76f51",
  "#c77dff",
  "#ffd166",
  "#06d6a0",
  "#ff6b9d",
];

async function uploadToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "Reservas");
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Error al subir la imagen");
  }
  const data = await res.json();
  return data.secure_url;
}

export default function BusinessProfilePage() {
  const { tenantId } = useAuth();
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
    instagramUrl: "",
    logoUrl: "",
    coverUrl: "",
  });
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [customAccent, setCustomAccent] = useState(DEFAULT_THEME.accent);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "tenants", tenantId));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name: d.name ?? "",
            description: d.description ?? "",
            address: d.address ?? "",
            phone: d.phone ?? "",
            instagramUrl: d.instagramUrl ?? "",
            logoUrl: d.logoUrl ?? "",
            coverUrl: d.coverUrl ?? "",
          });
          const t = d.theme || {};
          const mode = t.mode === "dark" ? "dark" : "light";
          const accent = t.accent || DEFAULT_THEME.accent;
          setTheme({ mode, accent });
          setCustomAccent(accent);
        }
      } catch (err) {
        if (!cancelled) setError("No se pudo cargar el negocio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setThemeField(field, value) {
    setTheme((t) => ({ ...t, [field]: value }));
  }

  function handleModeChange(nextMode) {
    setTheme((t) => ({
      ...t,
      mode: nextMode,
    }));
  }

  function handleSelectRecommended(color) {
    setTheme((t) => ({
      ...t,
      accent: color,
    }));
  }

  function normalizeHex(value) {
    const v = value.trim();
    if (!v) return "";
    return v.startsWith("#") ? v : `#${v}`;
  }

  const recommendedList =
    theme.mode === "dark" ? DARK_ACCENTS : LIGHT_ACCENTS;
  const accentLower = (theme.accent || "").toLowerCase();
  const isAccentRecommended = recommendedList.some(
    (c) => c.toLowerCase() === accentLower,
  );
  const customActive = !isAccentRecommended;

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    setUploadingLogo(true);
    setError(null);
    try {
      const secureUrl = await uploadToCloudinary(
        file,
        `barberia/${tenantId}/logo`
      );
      setForm((f) => ({ ...f, logoUrl: secureUrl }));
    } catch (err) {
      setError(err.message || "Error al subir el logo");
    } finally {
      URL.revokeObjectURL(url);
      setLogoPreview(null);
      setUploadingLogo(false);
    }
  }

  async function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const url = URL.createObjectURL(file);
    setCoverPreview(url);
    setUploadingCover(true);
    setError(null);
    try {
      const secureUrl = await uploadToCloudinary(
        file,
        `barberia/${tenantId}/cover`
      );
      setForm((f) => ({ ...f, coverUrl: secureUrl }));
    } catch (err) {
      setError(err.message || "Error al subir la portada");
    } finally {
      URL.revokeObjectURL(url);
      setCoverPreview(null);
      setUploadingCover(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tenantId) return;
    if (!form.name.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, "tenants", tenantId), {
        name: form.name.trim(),
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        instagramUrl: form.instagramUrl.trim() || null,
        logoUrl: form.logoUrl || null,
        coverUrl: form.coverUrl || null,
        theme: {
          mode: theme.mode === "dark" ? "dark" : "light",
          accent: theme.accent || DEFAULT_THEME.accent,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Mi negocio">
        <div className="business-profile-page">
          <div className="admin-page-header">
            <h1 className="admin-page-title">Mi negocio</h1>
          </div>
          <p className="business-profile-loading">Cargando...</p>
        </div>
      </AdminLayout>
    );
  }

  const logoDisplay = logoPreview || form.logoUrl;
  const logoInitial = form.name.trim()
    ? form.name.trim().charAt(0).toUpperCase()
    : "?";

  const coverDisplay = coverPreview || form.coverUrl;

  return (
    <AdminLayout title="Mi negocio">
      <div className="business-profile-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Mi negocio</h1>
        </div>
        <form className="business-profile-form" onSubmit={handleSubmit}>
          {/* Logo */}
          <div className="business-profile-logo-wrap">
            <button
              type="button"
              className="business-profile-logo-btn"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              aria-label="Cambiar logo"
            >
              <div
                className={`business-profile-logo ${uploadingLogo ? "business-profile-logo--uploading" : ""}`}
              >
                {logoDisplay ? (
                  <img
                    src={logoDisplay}
                    alt=""
                    className="business-profile-logo__img"
                  />
                ) : (
                  <span className="business-profile-logo__initial">
                    {logoInitial}
                  </span>
                )}
                <span className="business-profile-logo__camera" aria-hidden="true">
                  <Camera size={16} />
                </span>
              </div>
              {uploadingLogo && (
                <span className="business-profile-logo__overlay">Subiendo...</span>
              )}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="business-profile-file-input"
              onChange={handleLogoChange}
              aria-hidden="true"
            />
          </div>

          {/* Portada */}
          <div className="business-profile-cover-wrap">
            <label className="business-profile-cover-label">
              Foto de portada
            </label>
            <button
              type="button"
              className="business-profile-cover-btn"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              aria-label="Cambiar portada"
            >
              <div
                className={`business-profile-cover ${uploadingCover ? "business-profile-cover--uploading" : ""}`}
              >
                {coverDisplay ? (
                  <img
                    src={coverDisplay}
                    alt=""
                    className="business-profile-cover__img"
                  />
                ) : (
                  <span className="business-profile-cover__placeholder">
                    <ImageIcon size={32} />
                  </span>
                )}
              </div>
              {uploadingCover && (
                <span className="business-profile-cover__overlay">Subiendo...</span>
              )}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="business-profile-file-input"
              onChange={handleCoverChange}
              aria-hidden="true"
            />
          </div>

          {error && <p className="business-profile-error">{error}</p>}

          <div className="form-field">
            <label htmlFor="business-name">Nombre del negocio *</label>
            <input
              id="business-name"
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Nombre del negocio"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="business-desc">
              Descripción{" "}
              <span className="business-profile-char-count">
                {form.description.length}/{DESC_MAX}
              </span>
            </label>
            <textarea
              id="business-desc"
              value={form.description}
              onChange={(e) =>
                setField("description", e.target.value.slice(0, DESC_MAX))
              }
              placeholder="Breve descripción del negocio"
              rows={3}
            />
          </div>

          <div className="form-field">
            <label htmlFor="business-address">Dirección</label>
            <input
              id="business-address"
              type="text"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="Dirección"
            />
          </div>

          <div className="form-field">
            <label htmlFor="business-phone">Teléfono</label>
            <input
              id="business-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+56 9 XXXX XXXX"
            />
          </div>

          <div className="form-field">
            <label htmlFor="business-instagram">Instagram</label>
            <input
              id="business-instagram"
              type="text"
              value={form.instagramUrl}
              onChange={(e) => setField("instagramUrl", e.target.value)}
              placeholder="@tulocal"
            />
          </div>

          <section className="business-profile-appearance">
            <h3 className="business-profile-appearance__title">
              Apariencia
            </h3>
            <p className="business-profile-appearance__subtitle">
              Elige el estilo visual que verán tus clientes al reservar.
            </p>

            {/* Selector de modo */}
            <div className="theme-mode-toggle">
              <button
                type="button"
                className={
                  "theme-mode-option" +
                  (theme.mode === "light"
                    ? " theme-mode-option--active"
                    : "")
                }
                onClick={() => handleModeChange("light")}
              >
                <span className="theme-mode-option__icon">
                  <Sun size={16} />
                </span>
                <span className="theme-mode-option__text">
                  <span className="theme-mode-option__label">Claro</span>
                  <span className="theme-mode-option__desc">
                    Fondo crema, ideal para la mayoría de negocios.
                  </span>
                </span>
                {theme.mode === "light" && (
                  <span className="theme-mode-option__check">✓</span>
                )}
              </button>

              <button
                type="button"
                className={
                  "theme-mode-option" +
                  (theme.mode === "dark"
                    ? " theme-mode-option--active"
                    : "")
                }
                onClick={() => handleModeChange("dark")}
              >
                <span className="theme-mode-option__icon">
                  <Moon size={16} />
                </span>
                <span className="theme-mode-option__text">
                  <span className="theme-mode-option__label">Oscuro</span>
                  <span className="theme-mode-option__desc">
                    Fondo oscuro elegante, ideal para barberías modernas.
                  </span>
                </span>
                {theme.mode === "dark" && (
                  <span className="theme-mode-option__check">✓</span>
                )}
              </button>
            </div>

            {/* Colores recomendados */}
            <div className="theme-recommended">
              <p className="theme-recommended__title">
                {theme.mode === "light"
                  ? "IDEALES PARA TEMA CLARO"
                  : "IDEALES PARA TEMA OSCURO"}
              </p>
              <div className="theme-recommended__swatches">
                {recommendedList.map((color) => {
                  const isActive =
                    color.toLowerCase() === accentLower;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={
                        "theme-color-swatch" +
                        (isActive ? " theme-color-swatch--active" : "")
                      }
                      style={{ backgroundColor: color }}
                      onClick={() => handleSelectRecommended(color)}
                      aria-label={`Usar color ${color}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Color personalizado */}
            <div className="theme-custom">
              <div className="theme-custom__header">
                <span className="theme-custom__title">
                  🎨 Color personalizado
                </span>
                <span
                  className={
                    "theme-custom__badge" +
                    (customActive
                      ? " theme-custom__badge--active"
                      : " theme-custom__badge--inactive")
                  }
                >
                  {customActive ? "ACTIVO" : "INACTIVO"}
                </span>
              </div>
              <p className="theme-custom__warning">
                ⚠️ Una mala elección de color puede dificultar la lectura.
                Asegúrate de que el color tenga suficiente contraste.
              </p>
              <div className="theme-custom__controls">
                <input
                  type="color"
                  className="theme-custom__color-input"
                  value={normalizeHex(customAccent || theme.accent)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomAccent(value);
                  }}
                />
                <input
                  type="text"
                  className="theme-custom__hex-input"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  placeholder="#c17b5c"
                />
                <button
                  type="button"
                  className="theme-custom__apply-btn"
                  onClick={() =>
                    setThemeField(
                      "accent",
                      normalizeHex(customAccent || theme.accent),
                    )
                  }
                >
                  Usar este color
                </button>
              </div>
            </div>

            {/* Vista previa */}
            <div className="theme-preview">
              <p className="theme-preview__label">VISTA PREVIA</p>
              <div
                className="theme-preview__card"
                style={{
                  backgroundColor:
                    theme.mode === "light" ? "#ffffff" : "#1f1f1f",
                  color:
                    theme.mode === "light" ? "#1a1a1a" : "#f0f0f0",
                }}
              >
                <p
                  className="theme-preview__name"
                  style={{ color: theme.accent }}
                >
                  {form.name || "Nombre del negocio"}
                </p>
                <div className="theme-preview__row">
                  <span>Servicio de ejemplo</span>
                  <span
                    className="theme-preview__price"
                    style={{ color: theme.accent }}
                  >
                    $15.000
                  </span>
                </div>
                <button
                  type="button"
                  className="theme-preview__button"
                  style={{
                    backgroundColor: theme.accent,
                    color: "#ffffff",
                  }}
                >
                  Reservar ahora
                </button>
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="btn-primary business-profile-save-btn"
            disabled={saving}
          >
            {saved ? (
              <>
                <Check size={16} /> Guardado
              </>
            ) : saving ? (
              "Guardando..."
            ) : (
              "Guardar cambios"
            )}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
