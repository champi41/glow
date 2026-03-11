// src/components/ui/AuthGuard.jsx

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AuthGuard({ children, requireManage = false }) {
  const { user, profile, loadingAuth, canManage } = useAuth();
  const location = useLocation();

  // ← Clave: mientras carga no hacer NADA, ni redirigir ni renderizar
  if (loadingAuth) return null;

  if (!user || !profile) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requireManage && !canManage) {
    return <Navigate to="/admin/reservas" replace />;
  }

  return children;
}
