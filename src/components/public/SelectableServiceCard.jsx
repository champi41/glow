import { CheckCircle2, Circle } from "lucide-react";
import { formatPrice } from "../../utils/format.js";
import "./SelectableServiceCard.css";

export default function SelectableServiceCard({ service, selected, onToggle }) {
  const { name, description, price, duration } = service ?? {};

  return (
    <div
      className={`selectable-card ${selected ? "selectable-card--selected" : ""}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
    >
      <div className="selectable-card__check">
        {selected ? (
          <CheckCircle2 size={20} aria-hidden="true" />
        ) : (
          <Circle size={20} aria-hidden="true" />
        )}
      </div>
      <div className="selectable-card__body">
        <span className="selectable-card__name">{name ?? ""}</span>
        {description && (
          <span className="selectable-card__desc">{description}</span>
        )}
      </div>
      <div className="selectable-card__aside">
        <span className="selectable-card__price">{formatPrice(price)}</span>
        {duration != null && (
          <span className="selectable-card__duration">{duration} min</span>
        )}
      </div>
    </div>
  );
}
