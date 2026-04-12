// src/pages/admin/BusinessProfilePage.jsx

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Check, Camera, Image as ImageIcon, Sun, Moon } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./BusinessProfilePage.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "djghs9u2k";
const DESC_MAX = 200;
const DEFAULT_THEME = {
  mode: "light",
  accent: "#c17b5c",
};

const DEFAULT_DEPOSIT = {
  enabled: false,
  type: "fixed",
  amount: 0,
  bankInfo: {
    bank: "",
    accountType: "",
    accountNumber: "",
    rut: "",
    holderName: "",
  },
};

const ACCOUNT_TYPES = [
  "Cuenta RUT",
  "Cuenta Corriente",
  "Cuenta Vista",
  "Cuenta Mercado Pago",
];

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
    { method: "POST", body: formData },
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
  const queryClient = useQueryClient();
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
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);

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
          const dep = d.deposit;
          if (dep && typeof dep === "object") {
            setDeposit({
              enabled: Boolean(dep.enabled),
              type: dep.type === "per_service" ? "per_service" : "fixed",
              amount: Number(dep.amount) || 0,
              bankInfo: {
                bank: dep.bankInfo?.bank ?? "",
                accountType: dep.bankInfo?.accountType ?? "",
                accountNumber: dep.bankInfo?.accountNumber ?? "",
                rut: dep.bankInfo?.rut ?? "",
                holderName: dep.bankInfo?.holderName ?? "",
              },
            });
          }
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

  function setDepositField(path, value) {
    if (path === "enabled" || path === "type" || path === "amount") {
      setDeposit((d) => ({ ...d, [path]: value }));
      return;
    }
    if (path.startsWith("bankInfo.")) {
      const key = path.replace("bankInfo.", "");
      setDeposit((d) => ({
        ...d,
        bankInfo: { ...d.bankInfo, [key]: value },
      }));
    }
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

  const recommendedList = theme.mode === "dark" ? DARK_ACCENTS : LIGHT_ACCENTS;
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
        `barberia/${tenantId}/logo`,
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
        `barberia/${tenantId}/cover`,
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

  async function handleRemoveCover() {
    if (!tenantId) return;
    if (!confirm("Quitar la foto de portada?")) return;
    setUploadingCover(true);
    setError(null);
    try {
      await updateDoc(doc(db, "tenants", tenantId), { coverUrl: null });
      setForm((f) => ({ ...f, coverUrl: null }));
    } catch (err) {
      console.error(err);
      setError("No se pudo quitar la portada.");
    } finally {
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
        deposit: {
          enabled: deposit.enabled,
          type: deposit.type,
          amount:
            deposit.enabled && deposit.type === "fixed"
              ? Number(deposit.amount) || 0
              : 0,
          bankInfo: deposit.enabled
            ? {
                bank: deposit.bankInfo.bank?.trim() || "",
                accountType: deposit.bankInfo.accountType?.trim() || "",
                accountNumber: deposit.bankInfo.accountNumber?.trim() || "",
                rut: deposit.bankInfo.rut?.trim() || "",
                holderName: deposit.bankInfo.holderName?.trim() || "",
              }
            : DEFAULT_DEPOSIT.bankInfo,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-by-id", tenantId] });
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
                <span className="business-profile-cover__overlay">
                  Subiendo...
                </span>
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
            {form.coverUrl && (
              <button
                type="button"
                className="business-profile-cover-remove"
                onClick={handleRemoveCover}
                disabled={uploadingCover}
                aria-label="Quitar portada"
              >
                Quitar portada
              </button>
            )}
          </div>

          {error && <p className="business-profile-error">{error}</p>}

          {/* Logo */}
          <div className="business-profile-logo-wrap">
            <div className="logobtn">
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
                  <span
                    className="business-profile-logo__camera"
                    aria-hidden="true"
                  >
                    <Camera size={16} />
                  </span>
                </div>
                {uploadingLogo && (
                  <span className="business-profile-logo__overlay">
                    Subiendo...
                  </span>
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

              {form.logoUrl && (
                <button
                  type="button"
                  className="business-profile-logo-remove"
                  onClick={async () => {
                    if (!tenantId) return;
                    if (!confirm("Quitar el logo?")) return;
                    setUploadingLogo(true);
                    try {
                      await updateDoc(doc(db, "tenants", tenantId), {
                        logoUrl: null,
                      });
                      setForm((f) => ({ ...f, logoUrl: null }));
                    } catch (err) {
                      console.error(err);
                      setError("No se pudo quitar el logo.");
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  aria-label="Quitar logo"
                >
                  Quitar logo
                </button>
              )}
            </div>

            <div className="nombreIg">
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
            </div>
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

          <section className="business-profile-appearance">
            <h3 className="business-profile-appearance__title">Apariencia</h3>
            <p className="business-profile-appearance__subtitle">
              Elige el estilo visual que verán tus clientes al reservar.
            </p>

            {/* Selector de modo */}
            <div className="theme-mode-toggle">
              <button
                type="button"
                className={
                  "theme-mode-option" +
                  (theme.mode === "light" ? " theme-mode-option--active" : "")
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
                  (theme.mode === "dark" ? " theme-mode-option--active" : "")
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
                  const isActive = color.toLowerCase() === accentLower;
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
                  color: theme.mode === "light" ? "#1a1a1a" : "#f0f0f0",
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

          {/* Sección Abono */}
          <section className="business-profile-deposit">
            <h3 className="business-profile-deposit__title">Abono</h3>
            <p className="business-profile-deposit__subtitle">
              Opcional. Si lo activas, los clientes deberán transferir un abono
              y subir el comprobante para confirmar la reserva.
            </p>

            <div className="business-profile-deposit-toggle-wrap">
              <span className="business-profile-deposit-toggle-label">
                Requerir abono para reservar
              </span>
              <button
                type="button"
                className={`business-profile-deposit-toggle ${deposit.enabled ? "business-profile-deposit-toggle--on" : ""}`}
                onClick={() => setDepositField("enabled", !deposit.enabled)}
                role="switch"
                aria-checked={deposit.enabled}
              >
                <span className="business-profile-deposit-toggle__track">
                  <span className="business-profile-deposit-toggle__thumb" />
                </span>
              </button>
            </div>

            {deposit.enabled && (
              <>
                <p className="business-profile-deposit-type-label">
                  Tipo de abono
                </p>
                <div className="inherit-toggle business-profile-deposit-type">
                  <button
                    type="button"
                    className={`inherit-btn ${deposit.type === "fixed" ? "inherit-btn--active" : ""}`}
                    onClick={() => setDepositField("type", "fixed")}
                  >
                    Monto fijo
                  </button>
                  <button
                    type="button"
                    className={`inherit-btn ${deposit.type === "per_service" ? "inherit-btn--active" : ""}`}
                    onClick={() => setDepositField("type", "per_service")}
                  >
                    Por servicio
                  </button>
                </div>

                {deposit.type === "fixed" && (
                  <div className="form-field">
                    <label htmlFor="deposit-amount">
                      Monto del abono (CLP)
                    </label>
                    <input
                      id="deposit-amount"
                      type="number"
                      min={0}
                      value={deposit.amount || ""}
                      onChange={(e) =>
                        setDepositField(
                          "amount",
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                    />
                  </div>
                )}

                {deposit.type === "per_service" && (
                  <p className="business-profile-deposit-per-service-hint">
                    Configura el abono de cada servicio en la sección Servicios.
                  </p>
                )}

                <p className="business-profile-deposit-bank-label">
                  Datos bancarios
                </p>
                <div className="business-profile-deposit-bank">
                  <div className="form-field">
                    <label htmlFor="deposit-bank">Banco</label>
                    <input
                      id="deposit-bank"
                      type="text"
                      value={deposit.bankInfo.bank}
                      onChange={(e) =>
                        setDepositField("bankInfo.bank", e.target.value)
                      }
                      placeholder="Banco Estado, Banco Chile, Mercado Pago..."
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="deposit-account-type">Tipo de cuenta</label>
                    <select
                      id="deposit-account-type"
                      value={deposit.bankInfo.accountType}
                      onChange={(e) =>
                        setDepositField("bankInfo.accountType", e.target.value)
                      }
                    >
                      <option value="">Selecciona</option>
                      {ACCOUNT_TYPES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="deposit-account-number">
                      Número de cuenta
                    </label>
                    <input
                      id="deposit-account-number"
                      type="text"
                      value={deposit.bankInfo.accountNumber}
                      onChange={(e) =>
                        setDepositField(
                          "bankInfo.accountNumber",
                          e.target.value,
                        )
                      }
                      placeholder="Número de cuenta"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="deposit-rut">RUT del titular</label>
                    <input
                      id="deposit-rut"
                      type="text"
                      value={deposit.bankInfo.rut}
                      onChange={(e) =>
                        setDepositField("bankInfo.rut", e.target.value)
                      }
                      placeholder="12.345.678-9"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="deposit-holder">Nombre del titular</label>
                    <input
                      id="deposit-holder"
                      type="text"
                      value={deposit.bankInfo.holderName}
                      onChange={(e) =>
                        setDepositField("bankInfo.holderName", e.target.value)
                      }
                      placeholder="Nombre del titular"
                    />
                  </div>
                </div>
              </>
            )}
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
