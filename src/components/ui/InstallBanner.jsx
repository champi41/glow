import { useEffect, useState } from "react";
import "./InstallBanner.css";

const DISMISS_KEY = "pwa-banner-dismissed";

export default function InstallBanner({ onInstall, mode = "install" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "true";
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleClose() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  return (
    <div className="install-banner">
      <div className="install-banner__inner">
        <div className="install-banner__info">
          <div className="install-banner__icon" aria-hidden="true">
            R
          </div>
          <div className="install-banner__text">
            <p className="install-banner__title">Instala la app</p>
            {mode === "ios" ? (
              <p className="install-banner__subtitle">
                En iPhone: Compartir → Añadir a pantalla de inicio.
              </p>
            ) : (
              <p className="install-banner__subtitle">
                Reserva más rápido desde tu pantalla de inicio.
              </p>
            )}
          </div>
        </div>
        <div className="install-banner__actions">
          {mode !== "ios" && (
            <button
              type="button"
              className="install-banner__btn"
              onClick={onInstall}
            >
              Instalar
            </button>
          )}
          <button
            type="button"
            className="install-banner__close"
            onClick={handleClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

