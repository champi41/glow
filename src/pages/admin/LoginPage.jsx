// src/pages/admin/LoginPage.jsx

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, loadingAuth, profile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin/reservas";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Navegar cuando profile esté listo
  useEffect(() => {
    if (!loadingAuth && user && profile) {
      navigate(from, { replace: true });
    }
  }, [loadingAuth, user, profile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">Bienvenido</h1>
          <p className="login-card__subtitle">
            Ingresa con tu cuenta para continuar
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary login-form__submit"
            disabled={submitting || !email || !password}
          >
            {submitting ? "Ingresando..." : "Ingresar →"}
          </button>
        </form>
      </div>
    </div>
  );
}
