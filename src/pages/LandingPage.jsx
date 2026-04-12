import { Link } from "react-router-dom";
import {
  CalendarClock,
  BellRing,
  Smartphone,
  BarChart3,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import "./LandingPage.css";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Agenda inteligente",
    text: "Gestiona citas, bloqueos y cambios en segundos, con una vista clara por día y profesional.",
  },
  {
    icon: BellRing,
    title: "Recordatorios automáticos",
    text: "Reduce ausencias con notificaciones y estados de reserva en tiempo real.",
  },
  {
    icon: Smartphone,
    title: "Experiencia móvil real",
    text: "Funciona como app instalable (PWA) para que tu equipo atienda desde el celular.",
  },
  {
    icon: BarChart3,
    title: "Operación ordenada",
    text: "Controla servicios, horarios, perfiles y reseñas desde un panel profesional.",
  },
];

const STEPS = [
  "Configuras tu negocio y servicios en minutos",
  "Tus clientes reservan online sin fricción",
  "Tu equipo administra todo desde la agenda",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-bg-orb landing-bg-orb--one" aria-hidden="true" />
      <div className="landing-bg-orb landing-bg-orb--two" aria-hidden="true" />

      <header className="landing-header">
        <div className="landing-shell landing-header__inner">
          <div className="landing-brand">
            <Sparkles size={16} />
            <span>Slotti</span>
          </div>
          <nav className="landing-nav">
            <a href="#beneficios">Beneficios</a>
            <a href="#como-funciona">Cómo funciona</a>
          </nav>
          <Link to="/admin/login" className="landing-login">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-kicker">
                Plataforma de reservas para negocios y profesionales
              </p>
              <h1>
                Convierte tu agenda en
                <span> crecimiento real</span>
              </h1>
              <p className="landing-subtitle">
                Slotti centraliza reservas, horarios y atención al cliente en
                una sola experiencia: más orden interno y mejor servicio para
                tus clientes.
              </p>

              <div className="landing-cta-row">
                <Link
                  to="/admin/login"
                  className="landing-cta landing-cta--primary"
                >
                  Entrar al panel <ArrowRight size={16} />
                </Link>
                <a
                  href="#beneficios"
                  className="landing-cta landing-cta--ghost"
                >
                  Ver beneficios
                </a>
              </div>

              <div className="landing-proof-row">
                <span>Ideal para barberías, salones, clínicas y estudios.</span>
              </div>
            </div>

            <aside
              className="landing-hero__panel"
              aria-label="Resumen de resultados"
            >
              <div className="landing-stat-card">
                <p className="label">Tiempo administrativo</p>
                <p className="value">-40%</p>
                <p className="hint">
                  Menos coordinación manual y menos llamadas.
                </p>
              </div>
              <div className="landing-stat-card">
                <p className="label">Visibilidad diaria</p>
                <p className="value">100%</p>
                <p className="hint">
                  Todo el equipo visualiza la agenda en un solo lugar.
                </p>
              </div>
              <div className="landing-stat-card">
                <p className="label">Atención más rápida</p>
                <p className="value">+ fluida</p>
                <p className="hint">
                  Menos fricción para reservar, confirmar y atender.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section
          id="beneficios"
          className="landing-section landing-section--features"
        >
          <div className="landing-shell">
            <h2>Todo lo que necesitas para operar mejor</h2>
            <div className="features-grid">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="feature-card">
                    <div className="feature-card__icon">
                      <Icon size={18} />
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="landing-section landing-section--steps"
        >
          <div className="landing-shell">
            <h2>Cómo funciona</h2>
            <div className="steps-list">
              {STEPS.map((step) => (
                <div key={step} className="step-item">
                  <CheckCircle2 size={18} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--cta">
          <div className="landing-shell landing-cta-banner">
            <div>
              <h2>
                Empieza a gestionar tus reservas con una imagen profesional
              </h2>
              <p>
                Tu operación diaria, clientes y equipo en una sola plataforma.
              </p>
            </div>
            <Link
              to="/admin/login"
              className="landing-cta landing-cta--primary"
            >
              Acceder ahora <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__inner">
          <span>© {new Date().getFullYear()} Slotti</span>
          <span>Reservas online para negocios y profesionales</span>
        </div>
      </footer>
    </div>
  );
}
