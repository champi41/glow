import "./Spinner.css";

export default function Spinner({ className = "" }) {
  return <div className={`spinner ${className}`.trim()} aria-hidden="true" />;
}