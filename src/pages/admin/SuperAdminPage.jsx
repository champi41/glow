import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "./SuperAdminPage.css";

function slugify(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

const DEFAULT_BUSINESS_HOURS = {
  monday: { open: "09:00", close: "18:00", isOpen: true },
  tuesday: { open: "09:00", close: "18:00", isOpen: true },
  wednesday: { open: "09:00", close: "18:00", isOpen: true },
  thursday: { open: "09:00", close: "18:00", isOpen: true },
  friday: { open: "09:00", close: "18:00", isOpen: true },
  saturday: { open: "10:00", close: "14:00", isOpen: true },
  sunday: { open: "00:00", close: "00:00", isOpen: false },
};

function useSuggestedTenantId(slug, tenantId) {
  return useMemo(() => tenantId?.trim() || slugify(slug), [slug, tenantId]);
}

function useSuggestedProfId(profSlug, profId) {
  return useMemo(
    () =>
      profId?.trim() || (slugify(profSlug) ? `prof-${slugify(profSlug)}` : ""),
    [profSlug, profId],
  );
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [logoutBusy, setLogoutBusy] = useState(false);

  // ─────────────────────────────────────────────────────────
  // Tenant form
  // ─────────────────────────────────────────────────────────
  const [tenantForm, setTenantForm] = useState({
    tenantId: "",
    slug: "",
    name: "",
    address: "",
    phone: "",
    instagramUrl: "",
    accent: "#c17b5c",
    mode: "light",
  });
  const suggestedTenantId = useSuggestedTenantId(
    tenantForm.slug,
    tenantForm.tenantId,
  );

  const [tenantBusy, setTenantBusy] = useState(false);
  const [tenantError, setTenantError] = useState(null);
  const [tenantOk, setTenantOk] = useState(null);

  // ─────────────────────────────────────────────────────────
  // Professional form
  // ─────────────────────────────────────────────────────────
  const [profForm, setProfForm] = useState({
    tenantId: "",
    profId: "",
    slug: "",
    name: "",
    role: "professional",
    order: 0,
    isActive: true,
    instagram: "",
    bio: "",
    photoUrl: "",
  });
  const suggestedProfId = useSuggestedProfId(profForm.slug, profForm.profId);

  const [profBusy, setProfBusy] = useState(false);
  const [profError, setProfError] = useState(null);
  const [profOk, setProfOk] = useState(null);

  // ─────────────────────────────────────────────────────────
  // User assignment form (opcional)
  // ─────────────────────────────────────────────────────────
  const [userForm, setUserForm] = useState({
    uid: "",
    role: "owner",
    tenantId: "",
    professionalId: "",
  });
  const [userBusy, setUserBusy] = useState(false);
  const [userError, setUserError] = useState(null);
  const [userOk, setUserOk] = useState(null);

  async function handleLogout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await logout();
    } finally {
      setLogoutBusy(false);
      navigate("/admin/login", { replace: true });
    }
  }

  function setTenantField(field, value) {
    setTenantForm((f) => ({ ...f, [field]: value }));
    setTenantError(null);
    setTenantOk(null);
  }

  function setProfField(field, value) {
    setProfForm((f) => ({ ...f, [field]: value }));
    setProfError(null);
    setProfOk(null);
  }

  function setUserField(field, value) {
    setUserForm((f) => ({ ...f, [field]: value }));
    setUserError(null);
    setUserOk(null);
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    setTenantError(null);
    setTenantOk(null);

    const slug = slugify(tenantForm.slug);
    const tenantId = slugify(suggestedTenantId);
    const name = tenantForm.name.trim();

    if (!slug) {
      setTenantError("El slug del negocio es obligatorio (ej: mi-negocio)");
      return;
    }
    if (!tenantId) {
      setTenantError("El tenantId es obligatorio");
      return;
    }
    if (!name) {
      setTenantError("El nombre del negocio es obligatorio");
      return;
    }

    setTenantBusy(true);
    try {
      // 1) No sobreescribir si ya existe el documento
      const tenantRef = doc(db, "tenants", tenantId);
      const existingTenant = await getDoc(tenantRef);
      if (existingTenant.exists()) {
        setTenantError(`Ya existe un tenant con id: ${tenantId}`);
        return;
      }

      // 2) Slug único (evita colisiones de URL)
      const slugQ = query(
        collection(db, "tenants"),
        where("slug", "==", slug),
        limit(1),
      );
      const slugSnap = await getDocs(slugQ);
      if (!slugSnap.empty) {
        setTenantError(`Ya existe un negocio con slug: ${slug}`);
        return;
      }

      const payload = {
        name,
        slug,
        address: tenantForm.address.trim() || "",
        phone: tenantForm.phone.trim() || "",
        instagramUrl: tenantForm.instagramUrl.trim() || "",
        plan: "free",
        createdAt: serverTimestamp(),
        businessHours: DEFAULT_BUSINESS_HOURS,
        theme: {
          mode: tenantForm.mode === "dark" ? "dark" : "light",
          accent: tenantForm.accent?.trim() || "#c17b5c",
        },
      };

      await setDoc(tenantRef, payload);

      setTenantOk({ tenantId, slug });
      // Sugerencias para los otros formularios
      setProfForm((f) => ({ ...f, tenantId }));
      setUserForm((f) => ({ ...f, tenantId }));
    } catch (err) {
      console.error(err);
      setTenantError(err?.message || "No se pudo crear el negocio.");
    } finally {
      setTenantBusy(false);
    }
  }

  async function handleCreateProfessional(e) {
    e.preventDefault();
    setProfError(null);
    setProfOk(null);

    const tenantId = slugify(profForm.tenantId);
    const slug = slugify(profForm.slug);
    const profId = slugify(suggestedProfId);
    const name = profForm.name.trim();

    if (!tenantId) {
      setProfError("tenantId es obligatorio");
      return;
    }
    if (!slug) {
      setProfError("El slug del profesional es obligatorio (ej: juan-perez)");
      return;
    }
    if (!profId) {
      setProfError("profId es obligatorio");
      return;
    }
    if (!name) {
      setProfError("El nombre del profesional es obligatorio");
      return;
    }

    setProfBusy(true);
    try {
      const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
      if (!tenantSnap.exists()) {
        setProfError(`No existe el tenant: ${tenantId}`);
        return;
      }

      // Slug único dentro del tenant
      const professionalsRef = collection(
        db,
        "tenants",
        tenantId,
        "professionals",
      );
      const slugQ = query(
        professionalsRef,
        where("slug", "==", slug),
        limit(1),
      );
      const slugSnap = await getDocs(slugQ);
      if (!slugSnap.empty) {
        setProfError(
          `Ya existe un profesional con slug: ${slug} en este negocio`,
        );
        return;
      }

      const profRef = doc(db, "tenants", tenantId, "professionals", profId);
      const existing = await getDoc(profRef);
      if (existing.exists()) {
        setProfError(`Ya existe un profesional con id: ${profId}`);
        return;
      }

      const payload = {
        name,
        slug,
        role: profForm.role || "professional",
        order: Number(profForm.order) || 0,
        isActive: profForm.isActive === false ? false : true,
        instagram: profForm.instagram.trim() || "",
        bio: profForm.bio.trim() || "",
        photoUrl: profForm.photoUrl.trim() || "",
        availability: null,
        createdAt: serverTimestamp(),
      };

      await setDoc(profRef, payload);

      setProfOk({ tenantId, profId, slug });
      setUserForm((f) => ({ ...f, tenantId, professionalId: profId }));
    } catch (err) {
      console.error(err);
      setProfError(err?.message || "No se pudo crear el profesional.");
    } finally {
      setProfBusy(false);
    }
  }

  async function handleUpsertUserProfile(e) {
    e.preventDefault();
    setUserError(null);
    setUserOk(null);

    const uid = userForm.uid.trim();
    const tenantId = slugify(userForm.tenantId);
    const professionalId = slugify(userForm.professionalId);
    const role = (userForm.role || "").trim();

    if (!uid) {
      setUserError("UID es obligatorio");
      return;
    }
    if (!tenantId) {
      setUserError("tenantId es obligatorio");
      return;
    }
    if (!role) {
      setUserError("El rol es obligatorio");
      return;
    }

    setUserBusy(true);
    try {
      const payload = {
        role,
        tenantId,
        professionalId: professionalId || null,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", uid), payload, { merge: true });
      setUserOk({ uid });
    } catch (err) {
      console.error(err);
      setUserError(err?.message || "No se pudo guardar el perfil del usuario.");
    } finally {
      setUserBusy(false);
    }
  }

  return (
    <div className="super-admin-page">
      <div className="super-admin-page__header">
        <div className="super-admin-page__header-row">
          <h1 className="super-admin-page__title">Super Admin</h1>
          <button
            type="button"
            className="btn-outline super-admin-page__logout"
            onClick={handleLogout}
            disabled={logoutBusy}
          >
            {logoutBusy ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
        <p className="super-admin-page__subtitle">
          Crear negocios, profesionales y asignaciones de usuarios.
        </p>
      </div>

      <section className="super-card">
        <h2 className="super-card__title">Crear negocio (tenant)</h2>

        <form className="super-form" onSubmit={handleCreateTenant}>
          <div className="super-row">
            <div className="super-field">
              <label>Slug *</label>
              <input
                type="text"
                value={tenantForm.slug}
                onChange={(e) => setTenantField("slug", e.target.value)}
                placeholder="mi-negocio"
              />
              <p className="super-hint">
                URL pública: /{slugify(tenantForm.slug) || "mi-negocio"}
              </p>
            </div>
            <div className="super-field">
              <label>Tenant ID (opcional)</label>
              <input
                type="text"
                value={tenantForm.tenantId}
                onChange={(e) => setTenantField("tenantId", e.target.value)}
                placeholder={slugify(tenantForm.slug) || "mi-negocio"}
              />
              <p className="super-hint">Si lo dejas vacío, se usa el slug.</p>
            </div>
          </div>

          <div className="super-field">
            <label>Nombre *</label>
            <input
              type="text"
              value={tenantForm.name}
              onChange={(e) => setTenantField("name", e.target.value)}
              placeholder="Peluquería / Barbería"
            />
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Teléfono (opcional)</label>
              <input
                type="text"
                value={tenantForm.phone}
                onChange={(e) => setTenantField("phone", e.target.value)}
                placeholder="+56912345678"
              />
            </div>
            <div className="super-field">
              <label>Instagram (opcional)</label>
              <input
                type="text"
                value={tenantForm.instagramUrl}
                onChange={(e) => setTenantField("instagramUrl", e.target.value)}
                placeholder="@mi_negocio"
              />
            </div>
          </div>

          <div className="super-field">
            <label>Dirección (opcional)</label>
            <input
              type="text"
              value={tenantForm.address}
              onChange={(e) => setTenantField("address", e.target.value)}
              placeholder="Av. ..."
            />
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Tema</label>
              <select
                value={tenantForm.mode}
                onChange={(e) => setTenantField("mode", e.target.value)}
              >
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </div>
            <div className="super-field">
              <label>Color acento</label>
              <input
                type="text"
                value={tenantForm.accent}
                onChange={(e) => setTenantField("accent", e.target.value)}
                placeholder="#c17b5c"
              />
            </div>
          </div>

          {tenantError && <p className="super-error">{tenantError}</p>}
          {tenantOk && (
            <p className="super-ok">
              Creado: tenantId <strong>{tenantOk.tenantId}</strong> (slug{" "}
              {tenantOk.slug})
            </p>
          )}

          <div className="super-actions">
            <button className="btn-primary" type="submit" disabled={tenantBusy}>
              {tenantBusy ? "Creando..." : "Crear negocio"}
            </button>
          </div>
        </form>
      </section>

      <section className="super-card">
        <h2 className="super-card__title">Crear profesional</h2>

        <form className="super-form" onSubmit={handleCreateProfessional}>
          <div className="super-row">
            <div className="super-field">
              <label>Tenant ID *</label>
              <input
                type="text"
                value={profForm.tenantId}
                onChange={(e) => setProfField("tenantId", e.target.value)}
                placeholder="mi-negocio"
              />
            </div>
            <div className="super-field">
              <label>Slug profesional *</label>
              <input
                type="text"
                value={profForm.slug}
                onChange={(e) => setProfField("slug", e.target.value)}
                placeholder="juan-perez"
              />
            </div>
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Prof ID (opcional)</label>
              <input
                type="text"
                value={profForm.profId}
                onChange={(e) => setProfField("profId", e.target.value)}
                placeholder={suggestedProfId || "prof-juan-perez"}
              />
              <p className="super-hint">
                Si lo dejas vacío, se usa prof-&lt;slug&gt;.
              </p>
            </div>
            <div className="super-field">
              <label>Rol</label>
              <select
                value={profForm.role}
                onChange={(e) => setProfField("role", e.target.value)}
              >
                <option value="professional">Profesional</option>
                <option value="manager">Encargado</option>
                <option value="owner">Dueño</option>
              </select>
            </div>
          </div>

          <div className="super-field">
            <label>Nombre *</label>
            <input
              type="text"
              value={profForm.name}
              onChange={(e) => setProfField("name", e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Orden</label>
              <input
                type="number"
                value={profForm.order}
                onChange={(e) => setProfField("order", e.target.value)}
                min={0}
                step={1}
              />
            </div>
            <div className="super-field super-field--inline">
              <label>Activo</label>
              <input
                type="checkbox"
                checked={profForm.isActive}
                onChange={(e) => setProfField("isActive", e.target.checked)}
              />
            </div>
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Instagram (opcional)</label>
              <input
                type="text"
                value={profForm.instagram}
                onChange={(e) => setProfField("instagram", e.target.value)}
                placeholder="@tuusuario"
              />
            </div>
            <div className="super-field">
              <label>Foto URL (opcional)</label>
              <input
                type="text"
                value={profForm.photoUrl}
                onChange={(e) => setProfField("photoUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="super-field">
            <label>Bio (opcional)</label>
            <textarea
              value={profForm.bio}
              onChange={(e) => setProfField("bio", e.target.value)}
              rows={2}
              placeholder="Breve descripción"
            />
          </div>

          {profError && <p className="super-error">{profError}</p>}
          {profOk && (
            <p className="super-ok">
              Creado: {profOk.profId} (/{profOk.tenantId}/pro/{profOk.slug})
            </p>
          )}

          <div className="super-actions">
            <button className="btn-primary" type="submit" disabled={profBusy}>
              {profBusy ? "Creando..." : "Crear profesional"}
            </button>
          </div>
        </form>
      </section>

      <section className="super-card">
        <h2 className="super-card__title">
          Asignar perfil de usuario (users/{"{uid}"})
        </h2>
        <p className="super-card__subtitle">
          Útil para dar acceso admin a un usuario existente de Firebase Auth.
        </p>

        <form className="super-form" onSubmit={handleUpsertUserProfile}>
          <div className="super-row">
            <div className="super-field">
              <label>UID *</label>
              <input
                type="text"
                value={userForm.uid}
                onChange={(e) => setUserField("uid", e.target.value)}
                placeholder="UID de Firebase Auth"
              />
            </div>
            <div className="super-field">
              <label>Rol *</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserField("role", e.target.value)}
              >
                <option value="owner">Dueño</option>
                <option value="manager">Encargado</option>
                <option value="professional">Profesional</option>
              </select>
            </div>
          </div>

          <div className="super-row">
            <div className="super-field">
              <label>Tenant ID *</label>
              <input
                type="text"
                value={userForm.tenantId}
                onChange={(e) => setUserField("tenantId", e.target.value)}
                placeholder="mi-negocio"
              />
            </div>
            <div className="super-field">
              <label>Professional ID (opcional)</label>
              <input
                type="text"
                value={userForm.professionalId}
                onChange={(e) => setUserField("professionalId", e.target.value)}
                placeholder="prof-juan-perez"
              />
            </div>
          </div>

          {userError && <p className="super-error">{userError}</p>}
          {userOk && (
            <p className="super-ok">Perfil guardado para UID: {userOk.uid}</p>
          )}

          <div className="super-actions">
            <button className="btn-primary" type="submit" disabled={userBusy}>
              {userBusy ? "Guardando..." : "Guardar perfil"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
