import ServiceCard from "./ServiceCard.jsx";
import "./ServiceList.css";

function groupByCategory(services) {
  const groups = {};
  for (const s of services ?? []) {
    const cat = s.category ?? "Otros";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }
  return groups;
}

export default function ServiceList({ services }) {
  const grouped = groupByCategory(services);
  const categories = Object.keys(grouped).sort();

  return (
    <div className="service-list">
      {categories.map((category) => (
        <div key={category} className="service-list__group">
          <p className="service-list__category">{category}</p>
          {grouped[category].map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ))}
    </div>
  );
}