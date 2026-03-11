import { useState, useEffect } from "react";

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/i.test(ua);
    setIsIOS(ios);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    function handler(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function promptInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  }

  return { canInstall: !!installPrompt && !isInstalled, promptInstall, isInstalled, isIOS };
}

