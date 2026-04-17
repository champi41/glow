// src/pages/admin/ServicesPage.jsx

import { useState, useMemo, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenantById } from "../../hooks/useTenant.js";
import { useServices } from "../../hooks/useServices.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "../../utils/format.js";
import { Plus, ToggleLeft, ToggleRight, X, Check, Trash2 } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./ServicesPage.css";

// ─── Estado vacío para el formulario ─────────────────────────
const EMPTY_FORM = {
  name: "",
  description: "",
  category: "",
  newCategory: "",
  price: "",
  duration: "",
  depositAmount: 0,
  professionalIds: [],
  isActive: true,
};

// ─── Modal de crear / editar servicio ────────────────────────
function ServiceModal({
  service,
  tenant,
  professionals,
  existingCategories,
  onSave,
  onDelete,
  onClose,
}) {
  const isEditing = !!service?.id;
  const showDepositAmount =
    tenant?.deposit?.enabled === true &&
    tenant?.deposit?.type === "per_service";

  const [form, setForm] = useState(() => {
    if (isEditing) {
      return {
        name: service.name || "",
        description: service.description || "",
        category: service.category || "",
        newCategory: "",
        price: String(service.price ?? ""),
        duration: String(service.duration ?? ""),
        depositAmount: Number(service.depositAmount) || 0,
        professionalIds: service.professionalIds || [],
        isActive: service.isActive ?? true,
      };
    }
    return { ...EMPTY_FORM };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: null }));
  }

  function toggleProf(profId) {
    setForm((f) => ({
      ...f,
      professionalIds: f.professionalIds.includes(profId)
        ? f.professionalIds.filter((id) => id !== profId)
        : [...f.professionalIds, profId],
    }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio";
    if (!form.price || isNaN(Number(form.price)))
      errs.price = "Precio inválido";
    if (!form.duration || isNaN(Number(form.duration)))
      errs.duration = "Duración inválida";
    if (form.professionalIds.length === 0)
      errs.profs = "Selecciona al menos un profesional";
    const cat = form.newCategory.trim() || form.category;
    if (!cat) errs.category = "Selecciona o crea una categoría";
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    const category = form.newCategory.trim() || form.category;

    await onSave({
      ...(isEditing ? { id: service.id } : {}),
      name: form.name.trim(),
      description: form.description.trim(),
      category,
      price: Number(form.price),
      duration: Number(form.duration),
      ...(showDepositAmount
        ? { depositAmount: Number(form.depositAmount) || 0 }
        : {}),
      professionalIds: form.professionalIds,
      isActive: form.isActive,
    });

    setSaving(false);
  }

  async function handleDelete() {
    if (!isEditing || !service?.id) return;

    const confirmed = window.confirm(
      `¿Eliminar "${service.name}"?\nEsta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await onDelete(service.id);
    } finally {
      setSaving(false);
    }
  }

  // Categorías disponibles: existentes + nueva si se escribe
  const categoryOptions = useMemo(() => {
    const set = new Set(existingCategories);
    return [...set];
  }, [existingCategories]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-card--form"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card__header">
          <h3 className="modal-card__title">
            {isEditing ? "Editar servicio" : "Nuevo servicio"}
          </h3>
          <button className="modal-card__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-card__body modal-card__body--scroll">
          {/* Nombre */}
          <div className="form-field">
            <label>Nombre *</label>
            <input
              type="text"
              placeholder="Ej: Corte clásico"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          {/* Descripción */}
          <div className="form-field">
            <label>
              Descripción <span className="form-optional">(opcional)</span>
            </label>
            <textarea
              placeholder="Describe brevemente el servicio..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          {/* Precio y duración */}
          <div className="form-row">
            <div className="form-field">
              <label>Precio (CLP) *</label>
              <input
                type="number"
                placeholder="12000"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                min={0}
              />
              {errors.price && (
                <span className="form-error">{errors.price}</span>
              )}
            </div>
            <div className="form-field">
              <label>Duración (min) *</label>
              <input
                type="number"
                placeholder="30"
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
                min={5}
                step={5}
              />
              {errors.duration && (
                <span className="form-error">{errors.duration}</span>
              )}
            </div>
          </div>

          {showDepositAmount && (
            <div className="form-field">
              <label>
                Abono requerido (CLP){" "}
                <span className="form-optional">(opcional)</span>
              </label>

              <input
                type="number"
                placeholder="0"
                min={0}
                value={form.depositAmount === 0 ? "" : form.depositAmount}
                onChange={(e) =>
                  set(
                    "depositAmount",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
              />
            </div>
          )}

          {/* Categoría */}
          <div className="form-field">
            <label>Categoría *</label>
            {categoryOptions.length > 0 && (
              <div className="category-chips">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={[
                      "category-chip",
                      form.category === cat && !form.newCategory
                        ? "category-chip--selected"
                        : "",
                    ].join(" ")}
                    onClick={() => {
                      set("category", cat);
                      set("newCategory", "");
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="O escribe una categoría nueva..."
              value={form.newCategory}
              onChange={(e) => {
                set("newCategory", e.target.value);
                if (e.target.value) set("category", "");
              }}
            />
            {errors.category && (
              <span className="form-error">{errors.category}</span>
            )}
          </div>

          {/* Profesionales */}
          <div className="form-field">
            <label>Profesionales *</label>
            <div className="prof-checkboxes">
              {professionals
                .filter((p) => p.isActive)
                .map((prof) => {
                  const checked = form.professionalIds.includes(prof.id);
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      className={[
                        "prof-checkbox",
                        checked ? "prof-checkbox--selected" : "",
                      ].join(" ")}
                      onClick={() => toggleProf(prof.id)}
                    >
                      {checked ? (
                        <Check size={13} />
                      ) : (
                        <div className="prof-checkbox__dot" />
                      )}
                      {prof.name}
                    </button>
                  );
                })}
            </div>
            {errors.profs && <span className="form-error">{errors.profs}</span>}
          </div>

          {/* Activo */}
          <div className="form-field form-field--row">
            <label>Visible para clientes</label>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => set("isActive", !form.isActive)}
            >
              {form.isActive ? (
                <ToggleRight size={28} className="toggle-btn--on" />
              ) : (
                <ToggleLeft size={28} className="toggle-btn--off" />
              )}
            </button>
          </div>
        </div>

        <div className="modal-card__actions">
          {isEditing && (
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button className="btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de servicio ─────────────────────────────────────────
function ServiceCard({ service, professionals, onEdit, onToggle }) {
  const profNames = service.professionalIds
    ?.map((id) => professionals.find((p) => p.id === id)?.name?.split(" ")[0])
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`service-card ${!service.isActive ? "service-card--inactive" : ""}`}
      onClick={() => onEdit(service)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(service);
        }
      }}
    >
      <div className="service-card__main">
        <div className="service-card__info">
          <span className="service-card__name">{service.name}</span>
          <span className="service-card__meta">
            {service.duration} min · {formatPrice(service.price)}
          </span>
          {profNames && (
            <span className="service-card__profs">{profNames}</span>
          )}
        </div>
        <div className="service-card__actions">
          <button
            className={`service-card-toggle ${service.isActive ? "service-card-toggle--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(service);
            }}
            title={service.isActive ? "Desactivar" : "Activar"}
            role="switch"
            aria-checked={service.isActive}
            aria-label={
              service.isActive ? "Desactivar servicio" : "Activar servicio"
            }
          >
            <span className="service-card-toggle__track">
              <span className="service-card-toggle__thumb" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function ServicesPage({ embedded = false }) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: tenant } = useTenantById(tenantId);
  const { data: services = [] } = useServices(tenantId);
  const { data: professionals = [] } = useProfessionals(tenantId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editService, setEditService] = useState(null);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  // Categorías existentes derivadas de los servicios
  const existingCategories = useMemo(() => {
    const cats = services.map((s) => s.category).filter(Boolean);
    return [...new Set(cats)];
  }, [services]);

  // Agrupar por categoría
  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const cat = s.category || "Sin categoría";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(s);
    }
    return map;
  }, [services]);

  function openCreate() {
    setEditService(null);
    setModalOpen(true);
  }

  function openEdit(service) {
    setEditService(service);
    setModalOpen(true);
  }

  async function handleSave(data) {
    const { id, ...fields } = data;
    try {
      if (id) {
        await updateDoc(doc(db, "tenants", tenantId, "services", id), fields);
      } else {
        await addDoc(collection(db, "tenants", tenantId, "services"), {
          ...fields,
          createdAt: serverTimestamp(),
          order: services.length,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["services", tenantId] });
      setModalOpen(false);
    } catch (err) {
      console.error("Error guardando servicio:", err);
      alert("No se pudo guardar el servicio. Intenta nuevamente.");
    }
  }

  async function handleDelete(serviceId) {
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "services", serviceId));
      queryClient.invalidateQueries({ queryKey: ["services", tenantId] });
      setModalOpen(false);
      setEditService(null);
    } catch (err) {
      console.error("Error eliminando servicio:", err);
      alert("No se pudo eliminar el servicio. Intenta nuevamente.");
    }
  }

  async function handleToggle(service) {
    try {
      await updateDoc(doc(db, "tenants", tenantId, "services", service.id), {
        isActive: !service.isActive,
      });
      queryClient.invalidateQueries({ queryKey: ["services", tenantId] });
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      alert("No se pudo cambiar el estado. Intenta nuevamente.");
    }
  }

  const content = (
    <>
      <div className="services-page">
        <button className="services-page__new" onClick={openCreate}>
          <Plus size={16} /> Nuevo servicio
        </button>

        {/* Lista agrupada por categoría */}
        {grouped.size === 0 ? (
          <div className="services-empty">
            <p>Aún no tienes servicios. Crea el primero.</p>
          </div>
        ) : (
          [...grouped.entries()].map(([cat, items]) => (
            <div key={cat} className="services-group">
              <p className="services-group__label">{cat}</p>
              <div className="services-group__list">
                {items.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    professionals={professionals}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ServiceModal
          service={editService}
          tenant={tenant}
          professionals={professionals}
          existingCategories={existingCategories}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );

  if (embedded) return content;

  return <AdminLayout title="Servicios">{content}</AdminLayout>;
}
