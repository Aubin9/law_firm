import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cabinet Juridique - Avocats & Conseil",
    short_name: "Cabinet",
    description: "Plateforme souveraine de gestion de cabinet d'avocats - Barreau du Cameroun / OHADA",
    start_url: "/fr",
    display: "standalone",
    background_color: "#0A192F",
    theme_color: "#0A192F",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
