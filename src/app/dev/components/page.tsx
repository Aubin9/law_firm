import { notFound } from "next/navigation";
import { ComponentGalleryShowcase } from "@/components/app/component-gallery-showcase";

export default function DevComponentsRootPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ComponentGalleryShowcase locale="fr" />;
}

