// src/pages/admin/ProfilePage.jsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Check,
  Camera,
  Plus,
  X,
  LogOut,
  Bell,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications.js";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./ProfilePage.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const BIO_MAX = 160;
const PORTFOLIO_MAX = 10;

async function uploadToCloudinary(
  file,
  tenantId,
  professionalId,
  subfolder = "",
) {
  const folder = subfolder
    ? `barberia/${tenantId}/${professionalId}/${subfolder}`
    : `barberia/${tenantId}/${professionalId}`;
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

export default function ProfilePage() {
  const { tenantId, professionalId, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const portfolioInputRef = useRef(null);
  const {
    permission,
    subscribed,
    loading: pushLoading,
    isSupported,
    subscribe,
    unsubscribe,
    error: pushError,
    isIOS,
    isStandalone,
  } = usePushNotifications({ tenantId, professionalId });

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    instagram: "",
    photoUrl: "",
    portfolioUrls: [],
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingPortfolioIndex, setUploadingPortfolioIndex] = useState(null);

  useEffect(() => {
    if (!tenantId || !professionalId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(
          doc(db, "tenants", tenantId, "professionals", professionalId),
        );
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name: d.name ?? "",
            bio: d.bio ?? "",
            instagram: d.instagram ?? "",
            photoUrl: d.photoUrl ?? "",
            portfolioUrls: Array.isArray(d.portfolioUrls)
              ? d.portfolioUrls
              : [],
          });
        }
      } catch (err) {
        if (!cancelled) setError("No se pudo cargar el perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, professionalId]);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleRemovePhoto() {
    if (!tenantId || !professionalId) return;
    if (!confirm("Quitar la foto de perfil?")) return;
    setUploading(true);
    setError(null);
    try {
      await updateDoc(
        doc(db, "tenants", tenantId, "professionals", professionalId),
        { photoUrl: null },
      );
      setForm((f) => ({ ...f, photoUrl: null }));
    } catch (err) {
      console.error(err);
      setError("No se pudo quitar la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploading(true);
    setError(null);
    try {
      const secureUrl = await uploadToCloudinary(
        file,
        tenantId,
        professionalId,
      );
      setForm((f) => ({ ...f, photoUrl: secureUrl }));
    } catch (err) {
      setError(err.message || "Error al subir la foto");
    } finally {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
      setUploading(false);
    }
  }

  function removePortfolioUrl(index) {
    setForm((f) => ({
      ...f,
      portfolioUrls: f.portfolioUrls.filter((_, i) => i !== index),
    }));
  }

  function handlePortfolioAddClick() {
    portfolioInputRef.current?.click();
  }

  async function handlePortfolioFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const urls = form.portfolioUrls ?? [];
    if (urls.length >= PORTFOLIO_MAX) return;

    setUploadingPortfolioIndex(urls.length);
    setError(null);
    try {
      const timestamp = Date.now();
      const secureUrl = await uploadToCloudinary(
        file,
        tenantId,
        professionalId,
        `portfolio/${timestamp}`,
      );
      setForm((f) => ({
        ...f,
        portfolioUrls: [...(f.portfolioUrls ?? []), secureUrl],
      }));
    } catch (err) {
      setError(err.message || "Error al subir la foto");
    } finally {
      setUploadingPortfolioIndex(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tenantId || !professionalId) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(
        doc(db, "tenants", tenantId, "professionals", professionalId),
        {
          name: form.name.trim() || null,
          bio: form.bio.trim() || null,
          instagram: form.instagram.trim() || null,
          photoUrl: form.photoUrl || null,
          portfolioUrls: form.portfolioUrls?.length ? form.portfolioUrls : [],
        },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  if (!professionalId) {
    return (
      <AdminLayout title="Mi perfil">
        <div className="profile-page">
          <div className="admin-page-header">
            <h1 className="admin-page-title">Mi perfil</h1>
            <button
              type="button"
              className="profile-logout-btn"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
          <p className="profile-empty">
            No tienes un perfil de profesional asociado.
          </p>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout title="Mi perfil">
        <div className="profile-page">
          <div className="admin-page-header">
            <h1 className="admin-page-title">Mi perfil</h1>
            <button
              type="button"
              className="profile-logout-btn"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
          <p className="profile-loading">Cargando perfil...</p>
        </div>
      </AdminLayout>
    );
  }

  const displayPhoto = previewUrl || form.photoUrl;
  const initial = form.name.trim()
    ? form.name.trim().charAt(0).toUpperCase()
    : "?";

  return (
    <AdminLayout title="Mi perfil">
      <div className="profile-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Mi perfil</h1>
          <button
            type="button"
            className="profile-logout-btn"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
        <form className="profile-form" onSubmit={handleSubmit}>
          {/* Avatar */}
          <div className="profile-avatar-wrap">
            <div className="logobtn">
              <button
                type="button"
                className="profile-avatar-btn"
                onClick={handleAvatarClick}
                disabled={uploading}
                aria-label="Cambiar foto"
              >
                <div
                  className={`profile-avatar ${uploading ? "profile-avatar--uploading" : ""}`}
                >
                  {displayPhoto ? (
                    <img
                      src={displayPhoto}
                      alt=""
                      className="profile-avatar__img"
                    />
                  ) : (
                    <span className="profile-avatar__initial">{initial}</span>
                  )}
                  <span className="profile-avatar__camera" aria-hidden="true">
                    <Camera size={16} />
                  </span>
                </div>
                {uploading && (
                  <span className="profile-avatar__overlay">Subiendo...</span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile-file-input"
                onChange={handleFileChange}
                aria-hidden="true"
              />
              {form.photoUrl && (
                <button
                  type="button"
                  className="profile-avatar-remove"
                  onClick={async (e) => {
                    e.preventDefault();
                    await handleRemovePhoto();
                  }}
                  disabled={uploading}
                  aria-label="Quitar foto"
                >
                  Quitar foto
                </button>
              )}
            </div>
            <div className="nombreIg">
              <div className="form-field">
                <label htmlFor="profile-name">Nombre</label>
                <input
                  id="profile-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="form-field">
                <label htmlFor="profile-instagram">Instagram</label>
                <input
                  id="profile-instagram"
                  type="text"
                  value={form.instagram}
                  onChange={(e) => setField("instagram", e.target.value)}
                  placeholder="@tuusuario"
                />
              </div>
            </div>
          </div>

          {error && <p className="profile-error">{error}</p>}

          <div className="form-field">
            <label htmlFor="profile-bio">
              Bio{" "}
              <span className="profile-char-count">
                {form.bio.length}/{BIO_MAX}
              </span>
            </label>
            <textarea
              id="profile-bio"
              value={form.bio}
              onChange={(e) =>
                setField("bio", e.target.value.slice(0, BIO_MAX))
              }
              placeholder="Breve descripción (máx. 160 caracteres)"
              rows={3}
            />
          </div>

          {/* Mis trabajos */}
          <div className="profile-portfolio">
            <h3 className="profile-portfolio__title">Mis trabajos</h3>
            <p className="profile-portfolio__subtitle">
              Máximo {PORTFOLIO_MAX} fotos
            </p>
            <div className="profile-portfolio__grid">
              {(form.portfolioUrls ?? []).map((url, index) => (
                <div key={url} className="profile-portfolio__thumb-wrap">
                  <img src={url} alt="" className="profile-portfolio__thumb" />
                  <button
                    type="button"
                    className="profile-portfolio__remove"
                    onClick={(e) => {
                      e.preventDefault();
                      removePortfolioUrl(index);
                    }}
                    aria-label="Eliminar foto"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {uploadingPortfolioIndex !== null && (
                <div
                  className="profile-portfolio__skeleton"
                  aria-hidden="true"
                />
              )}
              {(form.portfolioUrls ?? []).length < PORTFOLIO_MAX &&
                uploadingPortfolioIndex === null && (
                  <button
                    type="button"
                    className="profile-portfolio__add"
                    onClick={handlePortfolioAddClick}
                    aria-label="Agregar foto"
                  >
                    <Plus size={24} aria-hidden="true" />
                  </button>
                )}
            </div>
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              className="profile-file-input"
              onChange={handlePortfolioFileChange}
              aria-hidden="true"
            />
          </div>

          <button
            type="submit"
            className="btn-primary profile-save-btn"
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

          {/* Notificaciones */}
          <div className="profile-notifications">
            <h3 className="profile-portfolio__title">Notificaciones</h3>
            {!isSupported ? (
              <p className="profile-notifications__hint">
                {isIOS
                  ? isStandalone
                    ? "En iPhone, las notificaciones push requieren iOS 16.4+. Si no aparecen, revisa Ajustes → Notificaciones y habilita las notificaciones de la app."
                    : "En iPhone, las notificaciones push requieren iOS 16.4+ y abrir la app desde el ícono (Añadir a pantalla de inicio)."
                  : "Tu navegador no soporta notificaciones push."}
              </p>
            ) : permission === "denied" ? (
              <p className="profile-notifications__hint">
                Bloqueaste las notificaciones. Actívalas desde la configuración
                de tu navegador.
              </p>
            ) : pushError ? (
              <p className="profile-notifications__hint">{pushError}</p>
            ) : (
              <div className="profile-notifications__row">
                <div className="profile-notifications__left">
                  <Bell size={16} aria-hidden="true" />
                  <span className="profile-notifications__text">
                    {subscribed
                      ? "Notificaciones activadas"
                      : "Recibe alertas de nuevas reservas"}
                  </span>
                </div>
                <button
                  type="button"
                  className="profile-notifications__toggle"
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  aria-label={
                    subscribed
                      ? "Desactivar notificaciones"
                      : "Activar notificaciones"
                  }
                >
                  {pushLoading ? (
                    <span className="profile-notifications__loading">...</span>
                  ) : subscribed ? (
                    <ToggleRight size={28} aria-hidden="true" />
                  ) : (
                    <ToggleLeft size={28} aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
