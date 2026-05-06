import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db } from "../../config/firebase.js";
import { useTenantById } from "../../hooks/useTenantById.js";
import { useServices } from "../../hooks/useServices.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./MonthlyReportPage.css";

function monthToId(date) {
  return format(date, "yyyy-MM");
}

export default function MonthlyReportPage() {
  const { tenantId, professionalId, canManage } = useAuth();
  const { data: tenant } = useTenantById(tenantId);
  const [month, setMonth] = useState(() => monthToId(new Date()));

  function parseMonthIdToDate(id) {
    if (!id) return new Date();
    const parts = String(id).split("-").map(Number);
    if (parts.length < 2) return new Date();
    return new Date(parts[0], parts[1] - 1, 1);
  }

  const monthDate = useMemo(() => parseMonthIdToDate(month), [month]);

  function goPrevMonth() {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() - 1);
    setMonth(monthToId(d));
  }

  function goNextMonth() {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    setMonth(monthToId(d));
  }

  const { data: services = [] } = useServices(tenantId);

  const { data: report, isLoading } = useQuery({
    queryKey: ["monthly-report", tenantId, professionalId, month],
    queryFn: async () => {
      if (!tenantId) return null;
      // Si es un profesional sin permiso de manage, leer su informe personal
      const isProfessionalView = professionalId && !canManage;
      const ref = isProfessionalView
        ? doc(
            db,
            "tenants",
            tenantId,
            "professionals",
            professionalId,
            "reports",
            month,
          )
        : doc(db, "tenants", tenantId, "reports", month);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    },
    enabled: !!tenantId && !!month,
    staleTime: 60 * 1000,
  });

  const { data: professionals = [] } = useProfessionals(tenantId);

  const serviceList = report?.services
    ? Object.entries(report.services).map(([id, v]) => ({
        id,
        count: v.count || 0,
        revenue: v.revenue || 0,
      }))
    : [];
  // join with service names
  const serviceMap = Object.fromEntries((services || []).map((s) => [s.id, s]));

  const sortedServices = serviceList
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Normalize report: support nested objects or flattened keys like 'paymentMethods.efectivo'
  const normalized = useMemo(() => {
    if (!report) return { totalEarned: 0, paymentMethods: {}, services: {} };

    const res = {
      totalEarned: report.totalEarned || 0,
      paymentMethods: {},
      services: {},
    };

    // copy nested objects if present
    if (report.paymentMethods && typeof report.paymentMethods === "object") {
      res.paymentMethods = { ...report.paymentMethods };
    }
    if (report.services && typeof report.services === "object") {
      // ensure counts/numbers
      Object.entries(report.services).forEach(([id, v]) => {
        res.services[id] = { count: v.count || 0, revenue: v.revenue || 0 };
      });
    }

    // also handle flattened field names at root like 'paymentMethods.efectivo' or 'services.<id>.count'
    Object.keys(report).forEach((k) => {
      if (k.startsWith("paymentMethods.")) {
        const method = k.split(".").slice(1).join(".");
        res.paymentMethods[method] = report[k];
      }
      if (k.startsWith("services.")) {
        const rest = k.substring("services.".length);
        const parts = rest.split(".");
        const sid = parts[0];
        const field = parts[1];
        res.services[sid] = res.services[sid] || { count: 0, revenue: 0 };
        if (field === "count") res.services[sid].count = report[k];
        if (field === "revenue") res.services[sid].revenue = report[k];
      }
    });

    return res;
  }, [report]);

  const servicesList = Object.entries(normalized.services).map(([id, v]) => ({
    id,
    count: v.count || 0,
    revenue: v.revenue || 0,
  }));

  const sorted = servicesList.sort((a, b) => b.count - a.count).slice(0, 10);

  const isProfessionalView = professionalId && !canManage;
  const currentProfessional = professionals.find(
    (p) => p.id === professionalId,
  );

  return (
    <AdminLayout
      title={
        isProfessionalView
          ? `Informe — ${currentProfessional?.name || "Mi informe"}`
          : "Informe mensual"
      }
    >
      <div className="monthly-report">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Informe mensual</h1>
          <div className="month-nav">
            <button
              className="month-nav__btn"
              onClick={goPrevMonth}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="month-nav__label">
              {format(monthDate, "MMMM yyyy", { locale: es })}
            </span>
            <button
              className="month-nav__btn"
              onClick={goNextMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <p>Cargando...</p>
        ) : (
          <div className="mr-grid">
            <section className="mr-card mr-total">
              <div className="mr-card__label">Total ganado</div>
              <div className="mr-card__value">
                {normalized.totalEarned || 0} CLP
              </div>
            </section>

            <section className="mr-card mr-payments">
              <h4>Por método de pago</h4>
              <ul className="mr-payments__list">
                <li>
                  Transferencia: {normalized.paymentMethods.transferencia || 0}{" "}
                  CLP
                </li>
                <li>Tarjeta: {normalized.paymentMethods.tarjeta || 0} CLP</li>
                <li>Efectivo: {normalized.paymentMethods.efectivo || 0} CLP</li>
              </ul>
            </section>

            <section className="mr-card mr-services">
              <h4>Servicios más reservados</h4>
              {sorted.length === 0 ? (
                <p>No hay datos para este mes.</p>
              ) : (
                <ol className="mr-services__list">
                  {sorted.map((s) => (
                    <li key={s.id}>
                      {serviceMap[s.id]?.name || s.id} — {s.count} reservas —{" "}
                      {s.revenue} CLP
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
