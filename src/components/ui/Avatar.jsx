import "./Avatar.css";

export default function Avatar({ src, alt, fallback, size = "md" }) {
  const content = src ? (
    <img src={src} alt={alt ?? ""} className="avatar__img" />
  ) : (
    <span className="avatar__fallback">{fallback ?? "?"}</span>
  );

  return (
    <div className={`avatar avatar--${size}`} role="img" aria-label={alt ?? undefined}>
      {content}
    </div>
  );
}
