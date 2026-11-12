import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/server/services/dashboard-service";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params?: { locale?: string };
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const dashboardData = await getDashboardData(session);

  return <DashboardClient data={dashboardData} locale={locale} />;
}
