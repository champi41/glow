import { useEffect } from "react";

export function useApplyTheme(tenant) {
  useEffect(() => {
    if (!tenant) return;

    const mode = tenant.theme?.mode || "light";
    const accent = tenant.theme?.accent || "#c17b5c";
    const isLight = mode === "light";

    const vars = {
      "--color-accent": accent,
      "--color-accent-bg": hexToRgba(accent, 0.08),
      "--color-bg": isLight ? "#faf8f5" : "#141414",
      "--color-bg-elevated": isLight ? "#ffffff" : "#1f1f1f",
      "--color-text-primary": isLight ? "#1a1a1a" : "#f0f0f0",
      "--color-text-secondary": isLight ? "#6b6560" : "#a0a0a0",
      "--color-text-tertiary": isLight ? "#a09b96" : "#666666",
      "--color-border": isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)",
      "--color-separator": isLight
        ? "rgba(0,0,0,0.06)"
        : "rgba(255,255,255,0.06)",
      "--color-surface": isLight
        ? "rgba(255,255,255,0.72)"
        : "rgba(255,255,255,0.05)",
      "--color-surface-2": isLight
        ? "rgba(0,0,0,0.04)"
        : "rgba(255,255,255,0.04)",
    };

    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Aplicar título y favicon del tenant si están disponibles
    const previousTitle = document.title;
    if (tenant.name) document.title = tenant.name;

    const iconLink = document.querySelector('link[rel="icon"]');
    const appleLink = document.querySelector('link[rel="apple-touch-icon"]');
    const previousIconHref = iconLink?.getAttribute("href");
    const previousAppleHref = appleLink?.getAttribute("href");
    if (tenant.logoUrl) {
      try {
        if (iconLink) iconLink.setAttribute("href", tenant.logoUrl);
        if (appleLink) appleLink.setAttribute("href", tenant.logoUrl);
      } catch (e) {
        // ignore
      }
    }

    // Actualizar meta theme-color si tenant.theme tiene accent
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const previousMetaTheme = metaTheme?.getAttribute("content");
    if (tenant.theme?.accent && metaTheme) {
      metaTheme.setAttribute("content", tenant.theme.accent);
    }

    return () => {
      Object.keys(vars).forEach((key) => {
        root.style.removeProperty(key);
      });
      // restaurar título y favicon
      if (previousTitle) document.title = previousTitle;
      if (iconLink && previousIconHref)
        iconLink.setAttribute("href", previousIconHref);
      if (appleLink && previousAppleHref)
        appleLink.setAttribute("href", previousAppleHref);
      if (metaTheme && previousMetaTheme)
        metaTheme.setAttribute("content", previousMetaTheme);
    };
  }, [tenant]);
}

function hexToRgba(hex, alpha) {
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) {
    return `rgba(193, 123, 92, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
