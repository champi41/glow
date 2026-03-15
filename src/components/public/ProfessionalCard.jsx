import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getFirstName } from "../../utils/format.js";
import "./ProfessionalCard.css";

function getRoleLabel(role) {
  const r = (role ?? "").toLowerCase();
  if (r === "owner") return "Dueño";
  if (r === "professional") return "Profesional";
  return role || "Profesional";
}

export default function ProfessionalCard({ professional, tenantSlug }) {
  const { slug: profSlug, name, bio, photoUrl, role } = professional ?? {};
  const initial = name ? name.trim().charAt(0).toUpperCase() : "?";

  return (
      <Link to={`/${tenantSlug}/pro/${profSlug}`} className="prof-card__link-wrap">
        <div className="prof-card__photo-wrap">
          {photoUrl ? (
            <img src={photoUrl} alt={name ?? ""} className="prof-card__photo" />
          ) : (
            <div className="prof-card__photo-initial">{initial}</div>
          )}
        </div>
        <div className="prof-card__body">
          <div>
            <h3 className="prof-card__name">{name ?? ""}</h3>
            {bio && <p className="prof-card__bio">{bio}</p>}
          </div>
          <span className="prof-card__link">
            Reservar con {getFirstName(name)} <ChevronRight size={13} aria-hidden="true" />
          </span>
        </div>
      </Link>
  );
}