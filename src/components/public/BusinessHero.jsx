import { MapPin, Phone, Instagram } from "lucide-react";
import { formatPhone } from "../../utils/phone.js";
import "./BusinessHero.css";

function getTitleParts(name) {
  if (!name || typeof name !== "string") return { first: "", rest: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { first: name, rest: "" };
  return { first: parts[0], rest: parts.slice(1).join(" ") };
}

export default function BusinessHero({ tenant, slug, onOpenLocationHours }) {
  const { name, description, coverUrl, logoUrl, address, phone, instagramUrl } =
    tenant ?? {};
  const hasCover = !!coverUrl;
  const hasLogo = !!logoUrl;
  const { first, rest } = getTitleParts(name);

  const whatsappHref = (() => {
    if (!phone || typeof phone !== "string") return null;
    const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!digits) return null;
    const text = `Hola! Quiero reservar en ${name ?? "su negocio"}.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  })();

  const instagramHref = (() => {
    if (!instagramUrl || typeof instagramUrl !== "string") return null;
    const raw = instagramUrl.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const username = raw.replace(/^@/, "").replace(/^instagram\.com\//i, "").replace(/\//g, "");
    if (!username) return null;
    return `https://www.instagram.com/${username}/`;
  })();

  return (
    <section className="hero">
      {hasCover && (
        <div className="hero__cover-wrap">
          <img src={coverUrl} alt={name ?? ""} className="hero__cover-img" />
          <div className="hero__cover-overlay" aria-hidden="true" />
        </div>
      )}

      <div className={`hero__body ${!hasCover ? "hero__body--no-cover" : ""}`}>
        <div className="hero__title-row">
          {hasLogo && (
            <img src={logoUrl} alt={name ?? ""} className="hero__logo" />
          )}
          <h1 className="hero__title">
            {first} {rest ? <em>{rest}</em> : null}
          </h1>
        </div>

        {description && <p className="hero__description">{description}</p>}

        <div className="hero__info" role="list">
          {onOpenLocationHours && (
            <button
              type="button"
              className="hero__pill"
              onClick={onOpenLocationHours}
              role="listitem"
            >
              <MapPin size={13} aria-hidden="true" />
              <span className="hero__pill-text">Ubicación y horario</span>
            </button>
          )}
          {phone && whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hero__pill"
              role="listitem"
            >
              <Phone size={13} aria-hidden="true" />
              {/* <span className="hero__pill-text">{formatPhone(phone)}</span> */}
            </a>
          )}
          {instagramHref && (
            <a href={instagramHref} className="hero__pill" role="listitem">
              <Instagram size={13} aria-hidden="true" />
              {/* <span className="hero__pill-text">Instagram</span> */}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
