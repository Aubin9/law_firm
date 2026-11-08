import { notFound } from "next/navigation";
import { ComponentGalleryShowcase } from "@/components/app/component-gallery-showcase";

export default function LocaleDevComponentsPage({
  params,
}: {
  params: { locale: string };
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const locale = params.locale === "en" ? "en" : "fr";
  return <ComponentGalleryShowcase locale={locale} />;
}

