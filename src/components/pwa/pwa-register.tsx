"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
    }

    // Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Listen for updates
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // New update available
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration skipped:", err);
        });
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  // Render a minimal prompt banner if installable and not in standalone
  if (!installPrompt || isStandalone) return null;

  return (
    <aside
      aria-label="Installation de l'application"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-primary/20 bg-card p-3 shadow-lg dark:border-border"
    >
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-foreground">Installer l&apos;application Cabinet</span>
        <span className="text-[11px] text-muted-foreground">Accès rapide palais &amp; audiences</span>
      </div>
      <button
        onClick={triggerInstall}
        className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Installer
      </button>
      <button
        onClick={() => setInstallPrompt(null)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        &times;
      </button>
    </aside>
  );
}
