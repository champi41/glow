// src/components/admin/AdminLayout.jsx

import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  UserCircle,
  Store,
  BarChart,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenantById } from "../../hooks/useTenant.js";
import { useEffect } from "react";
import { usePWAInstall } from "../../hooks/usePWAInstall.js";
import InstallBanner from "../ui/InstallBanner.jsx";
import "./AdminLayout.css";

const NAV_ITEMS = [
  {
    to: "/admin/reservas",
    icon: ClipboardList,
    label: "Reservas",
    manageOnly: false,
  },
  {
    to: "/admin/agenda",
    icon: CalendarDays,
    label: "Agenda",
    manageOnly: false,
  },
  {
    to: "/admin/informes",
    icon: BarChart,
    label: "Informes",
    manageOnly: true,
    showToProfessionals: true,
  },
  {
    to: "/admin/negocio",
    icon: Store,
    label: "Negocio",
    manageOnly: true,
  },
  {
    to: "/admin/perfil",
    icon: UserCircle,
    label: "Perfil",
    manageOnly: false,
  },
];

export default function AdminLayout({ children, title }) {
  const { canManage, tenantId, professionalId } = useAuth();
  const { data: tenant } = useTenantById(tenantId);
  const isIndividualPlan = tenant?.plan === "individual";

  // Ajustar título y favicon del dashboard admin según tenant
  useEffect(() => {
    if (!tenant) return;

    const previousTitle = document.title;
    const iconLink = document.querySelector('link[rel="icon"]');
    const appleLink = document.querySelector('link[rel="apple-touch-icon"]');
    const previousIconHref = iconLink?.getAttribute("href");
    const previousAppleHref = appleLink?.getAttribute("href");

    const chosenTitle = tenant.name || previousTitle;
    const chosenIcon = tenant.logoUrl || previousIconHref || "/favicon.ico";

    try {
      if (chosenTitle) document.title = chosenTitle;
      if (iconLink && chosenIcon) iconLink.setAttribute("href", chosenIcon);
      if (appleLink && chosenIcon) appleLink.setAttribute("href", chosenIcon);
    } catch (e) {
      // ignore
    }

    return () => {
      if (previousTitle) document.title = previousTitle;
      if (iconLink && previousIconHref)
        iconLink.setAttribute("href", previousIconHref);
      if (appleLink && previousAppleHref)
        appleLink.setAttribute("href", previousAppleHref);
    };
  }, [tenant]);

  const { canInstall, promptInstall, isInstalled, isIOS } = usePWAInstall();
  const showIOSHint = isIOS && !isInstalled;

  // Filtrar nav según rol
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isIndividualPlan && item.to === "/admin/perfil") return false;
    // If not restricted to managers, always visible
    if (!item.manageOnly) return true;
    // Managers/owners see it
    if (canManage) return true;
    // Some items are explicitly visible to professionals
    if (item.showToProfessionals && professionalId) return true;
    return false;
  });

  return (
    <div className="admin-layout">
      {/* Contenido */}
      <main className="admin-main">{children}</main>

      {/* Bottom navigation */}
      <nav className="admin-bottom-nav">
        {visibleItems.map((item) => {
          const isIndividualProfile =
            isIndividualPlan && item.to === "/admin/negocio";
          const label = isIndividualProfile ? "Perfil" : item.label;
          const IconComponent = isIndividualProfile ? UserCircle : item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                [
                  "admin-nav-item",
                  isActive ? "admin-nav-item--active" : "",
                ].join(" ")
              }
            >
              <IconComponent size={25} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {(canInstall || showIOSHint) && (
        <InstallBanner
          onInstall={canInstall ? promptInstall : undefined}
          mode={showIOSHint ? "ios" : "install"}
        />
      )}
    </div>
  );
}
