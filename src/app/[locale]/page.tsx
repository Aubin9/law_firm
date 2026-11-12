import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function LocaleHomePage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params?.locale === "en" ? "en" : "fr";
  const session = await getServerSession();

  if (session) {
    redirect(`/${locale}/dashboard`);
  } else {
    redirect(`/${locale}/login`);
  }
}

