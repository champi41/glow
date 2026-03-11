import { useNavigate } from "react-router-dom";
import { ChevronLeft, Instagram } from "lucide-react";
import "./ProfessionalHero.css";

function getTitleParts(name) {
  if (!name || typeof name !== "string") return { first: "", rest: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { first: name, rest: "" };
  return { first: parts[0], rest: parts.slice(1).join(" ") };
}

function getRoleLabel(role) {
  const r = (role ?? "").toLowerCase();
  if (r === "owner") return "Dueño";
  if (r === "manager") return "Encargado";
  if (r === "professional") return "Profesional";
  return role || "Profesional";
}

export default function ProfessionalHero({
  professional,
  tenantSlug,
  tenantName,
}) {
  const navigate = useNavigate();
  const { name, bio, photoUrl, role, instagram } = professional ?? {};
  const hasCover = !!photoUrl;
  const { first, rest } = getTitleParts(name);

  return (
    <section className="prof-hero">
      {hasCover && (
        <div className="prof-hero__cover-wrap">
          <img
            src={photoUrl}
            alt={name ?? ""}
            className="prof-hero__cover-img"
          />
          <div className="prof-hero__cover-overlay" aria-hidden="true" />
        </div>
      )}

      <div
        className={`prof-hero__body ${!hasCover ? "prof-hero__body--no-cover" : ""}`}
      >
        <button
          type="button"
          className="prof-hero__back"
          onClick={() => navigate(`/${tenantSlug}`)}
        >
          <ChevronLeft size={14} aria-hidden="true" /> {tenantName}
        </button>
        <h1 className="prof-hero__name">
          {first} {rest ? <em>{rest}</em> : null}
        </h1>
        {bio && <p className="prof-hero__bio">{bio}</p>}

        <div className="prof-hero__info">
          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="prof-hero__info-item prof-hero__info-item--link"
            >
              <Instagram size={12} aria-hidden="true" /> Instagram
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
