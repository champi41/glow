import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./SiteNav.css";

export default function SiteNav({ tenant, slug }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`site-nav ${visible ? "site-nav--visible" : ""}`} aria-label="Navegación principal">
      <div className="site-nav__inner">
        <span className="site-nav__name">{tenant?.name ?? ""}</span>
        <Link to={`/${slug}/reservar`} className="btn-outline site-nav__btn">
          Reservar
        </Link>
      </div>
    </nav>
  );
}
