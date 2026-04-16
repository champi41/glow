import { formatPrice } from "../../utils/format.js";
import "./ServiceCard.css";

export default function ServiceCard({ service, showDeposit = false }) {
  const { name, description, price, duration } = service ?? {};
  const depositAmount = Number(service?.depositAmount) || 0;

  return (
    <div className="service-row">
      <div className="service-row__left">
        <span className="service-row__name">{name ?? ""}</span>
        {description && (
          <span className="service-row__desc">{description}</span>
        )}
      </div>
      <span className="service-row__dots" aria-hidden="true" />
      <div className="service-row__right">
        <span className="service-row__price">{formatPrice(price)}</span>
        {showDeposit && depositAmount > 0 && (
          <span className="service-row__deposit">
            Abono: {formatPrice(depositAmount)}
          </span>
        )}
        {duration != null && (
          <span className="service-row__duration">{duration} min</span>
        )}
      </div>
    </div>
  );
}
