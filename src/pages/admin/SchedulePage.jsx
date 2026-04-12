// src/pages/admin/SchedulePage.jsx

import { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenantById } from "../../hooks/useTenantById.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./SchedulePage.css";

// ─── Constantes ───────────────────────────────────────────────
const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const TIME_OPTIONS = [];
for (let h = 7; h <= 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

const DEFAULT_BREAK = { hasBreak: false, start: "13:00", end: "14:00" };
const DEFAULT_DAY = {
  isOpen: false,
  open: "09:00",
  close: "19:00",
  break: DEFAULT_BREAK,
};
const DEFAULT_AVAIL = {
  isWorking: false,
  start: "09:00",
  end: "19:00",
  break: DEFAULT_BREAK,
};

// ─── Fila de un día (negocio o profesional) ───────────────────
function DayRow({ day, value, onChange, isProf = false }) {
  const isOpenKey = isProf ? "isWorking" : "isOpen";
  const openKey = isProf ? "start" : "open";
  const closeKey = isProf ? "end" : "close";

  const isOn = value?.[isOpenKey] ?? false;
  const breakVal =
    value?.break != null ? { ...DEFAULT_BREAK, ...value.break } : DEFAULT_BREAK;

  function update(partial) {
    onChange({ ...value, ...partial, break: partial.break ?? breakVal });
  }

  return (
    <div className={`day-row ${isOn ? "day-row--on" : "day-row--off"}`}>
      <button
        className="day-row__toggle"
        onClick={() => update({ [isOpenKey]: !isOn })}
      >
        <div className={`day-dot ${isOn ? "day-dot--on" : ""}`} />
        <span className="day-row__label">{day.label}</span>
      </button>

      {isOn && (
        <>
          <div className="day-row__times">
            <select
              className="time-select"
              value={value?.[openKey] || "09:00"}
              onChange={(e) => update({ [openKey]: e.target.value })}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="time-separator">–</span>
            <select
              className="time-select"
              value={value?.[closeKey] || "19:00"}
              onChange={(e) => update({ [closeKey]: e.target.value })}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="day-row__break">
            <button
              type="button"
              className="day-row__break-toggle"
              onClick={() =>
                update({
                  break: { ...breakVal, hasBreak: !breakVal.hasBreak },
                })
              }
            >
              <div
                className={`day-dot ${breakVal.hasBreak ? "day-dot--on" : ""}`}
              />
              <span className="day-row__break-label">Tiene descanso</span>
            </button>
            {breakVal.hasBreak && (
              <div className="day-row__break-times">
                <select
                  className="time-select"
                  value={breakVal.start}
                  onChange={(e) =>
                    update({
                      break: { ...breakVal, start: e.target.value },
                    })
                  }
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="time-separator">–</span>
                <select
                  className="time-select"
                  value={breakVal.end}
                  onChange={(e) =>
                    update({
                      break: { ...breakVal, end: e.target.value },
                    })
                  }
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sección de horario del negocio ──────────────────────────
function BusinessSchedule({ tenant, tenantId, queryClient }) {
  const [hours, setHours] = useState(() => tenant?.businessHours || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleDayChange(dayKey, value) {
    setHours((h) => ({ ...h, [dayKey]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenantId), {
        businessHours: hours,
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-by-id", tenantId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error guardando horario:", err);
      alert("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="schedule-section">
      <p className="schedule-section__title">Horario del negocio</p>
      <p className="schedule-section__subtitle">
        Los profesionales sin horario propio heredan este horario.
      </p>

      <div className="days-list">
        {DAYS.map((day) => (
          <DayRow
            key={day.key}
            day={day}
            value={hours[day.key] || DEFAULT_DAY}
            onChange={(v) => handleDayChange(day.key, v)}
          />
        ))}
      </div>

      <button
        className="btn-primary schedule-save-btn"
        onClick={handleSave}
        disabled={saving}
      >
        {saved ? (
          <>
            <Check size={15} /> Guardado
          </>
        ) : saving ? (
          "Guardando..."
        ) : (
          "Guardar horario"
        )}
      </button>
    </div>
  );
}

// ─── Sección de horario de un profesional ────────────────────
function ProfSchedule({ prof, tenantId, queryClient }) {
  const [expanded, setExpanded] = useState(false);

  // null = hereda negocio, objeto = horario propio
  const hasOwn = prof.availability !== null && prof.availability !== undefined;

  const [useOwn, setUseOwn] = useState(hasOwn);
  const [avail, setAvail] = useState(() => {
    if (hasOwn) return prof.availability;
    // Inicializar con todos los días desactivados
    return Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_AVAIL }]));
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleDayChange(dayKey, value) {
    setAvail((a) => ({ ...a, [dayKey]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenantId, "professionals", prof.id), {
        availability: useOwn ? avail : null,
      });
      queryClient.invalidateQueries({ queryKey: ["professionals", tenantId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error guardando horario:", err);
      alert("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prof-schedule">
      {/* Header colapsable */}
      <button
        className="prof-schedule__header"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="prof-schedule__info">
          {prof.photoUrl ? (
            <img
              src={prof.photoUrl}
              alt={prof.name}
              className="prof-schedule__avatar"
            />
          ) : (
            <div className="prof-schedule__avatar prof-schedule__avatar--initial">
              {prof.name.charAt(0)}
            </div>
          )}
          <div className="prof-schedule__meta">
            <span className="prof-schedule__name">{prof.name}</span>
            <span className="prof-schedule__hint">
              {hasOwn ? "Horario propio" : "Hereda del negocio"}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="prof-schedule__chevron" />
        ) : (
          <ChevronDown size={16} className="prof-schedule__chevron" />
        )}
      </button>

      {/* Contenido expandido */}
      {expanded && (
        <div className="prof-schedule__body">
          {/* Toggle hereda / propio */}
          <div className="inherit-toggle">
            <button
              className={`inherit-btn ${!useOwn ? "inherit-btn--active" : ""}`}
              onClick={() => {
                setUseOwn(false);
                setSaved(false);
              }}
            >
              Hereda del negocio
            </button>
            <button
              className={`inherit-btn ${useOwn ? "inherit-btn--active" : ""}`}
              onClick={() => {
                setUseOwn(true);
                setSaved(false);
              }}
            >
              Horario propio
            </button>
          </div>

          {useOwn && (
            <div className="days-list days-list--compact">
              {DAYS.map((day) => (
                <DayRow
                  key={day.key}
                  day={day}
                  value={avail[day.key] || DEFAULT_AVAIL}
                  onChange={(v) => handleDayChange(day.key, v)}
                  isProf
                />
              ))}
            </div>
          )}

          <button
            className="btn-primary schedule-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? (
              <>
                <Check size={15} /> Guardado
              </>
            ) : saving ? (
              "Guardando..."
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function SchedulePage({ embedded = false }) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: tenant, isLoading } = useTenantById(tenantId);
  const { data: professionals = [] } = useProfessionals(tenantId);

  const activeProfs = useMemo(
    () => professionals.filter((p) => p.isActive),
    [professionals],
  );

  if (!tenant && isLoading) {
    const loadingContent = (
      <div className="schedule-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Horario</h1>
        </div>
        <div className="schedule-loading">Cargando...</div>
      </div>
    );
    if (embedded) return loadingContent;
    return <AdminLayout title="Horario">{loadingContent}</AdminLayout>;
  }

  if (!tenant && !isLoading) {
    const emptyContent = (
      <div className="schedule-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Horario</h1>
        </div>
        <div className="schedule-loading">No se encontró el negocio.</div>
      </div>
    );
    if (embedded) return emptyContent;
    return <AdminLayout title="Horario">{emptyContent}</AdminLayout>;
  }

  const content = (
    <div className="schedule-page">

      {/* Horario del negocio */}
      <BusinessSchedule
        tenant={tenant}
        tenantId={tenantId}
        queryClient={queryClient}
      />

      {/* Horarios por profesional */}
      {activeProfs.length > 0 && (
        <div className="schedule-section">
          <p className="schedule-section__title">Horario por profesional</p>
          <p className="schedule-section__subtitle">
            Configura un horario distinto al del negocio para cada uno.
          </p>
          <div className="prof-schedules-list">
            {activeProfs.map((prof) => (
              <ProfSchedule
                key={prof.id}
                prof={prof}
                tenantId={tenantId}
                queryClient={queryClient}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return <AdminLayout title="Horario">{content}</AdminLayout>;
}
