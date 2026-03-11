import { formatPrice } from "../../utils/format.js";
import "./ServiceCard.css";

export default function ServiceCard({ service }) {
  const { name, description, price, duration } = service ?? {};

  return (
    <div className="service-row">
      <div className="service-row__left">
        <span className="service-row__name">{name ?? ""}</span>
        {description && <span className="service-row__desc">{description}</span>}
      </div>
      <span className="service-row__dots" aria-hidden="true" />
      <div className="service-row__right">
        <span className="service-row__price">{formatPrice(price)}</span>
        {duration != null && <span className="service-row__duration">{duration} min</span>}
      </div>
    </div>
  );
}