// src/components/admin/AdminLayout.jsx

import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Scissors,
  Clock,
  UserCircle,
  Store,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
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
    to: "/admin/negocio",
    icon: Store,
    label: "Negocio",
    manageOnly: true,
  },
  {
    to: "/admin/servicios",
    icon: Scissors,
    label: "Servicios",
    manageOnly: true,
  },
  {
    to: "/admin/horario",
    icon: Clock,
    label: "Horario",
    manageOnly: true,
  },
  {
    to: "/admin/resenas",
    icon: Star,
    label: "Reseñas",
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
  const { canManage } = useAuth();
  const { canInstall, promptInstall, isInstalled, isIOS } = usePWAInstall();
  const showIOSHint = isIOS && !isInstalled;

  // Filtrar nav según rol
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.manageOnly || canManage,
  );

  return (
    <div className="admin-layout">
      {/* Contenido */}
      <main className="admin-main">{children}</main>

      {/* Bottom navigation */}
      <nav className="admin-bottom-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              ["admin-nav-item", isActive ? "admin-nav-item--active" : ""].join(
                " ",
              )
            }
          >
            <item.icon size={22} strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
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
