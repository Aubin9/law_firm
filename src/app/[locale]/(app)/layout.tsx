import React from "react";
import { getServerSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string } | Promise<{ locale: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const locale = (resolvedParams?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const session = await getServerSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const roleLabels: Record<string, { fr: string; en: string }> = {
    PARTNER: { fr: "Associé Gérant", en: "Managing Partner" },
    LEAD_LAWYER: { fr: "Avocat Principal", en: "Lead Lawyer" },
    ASSOCIATE_LAWYER: { fr: "Avocat Collaborateur", en: "Associate Lawyer" },
    LEGAL_ASSISTANT: { fr: "Juriste / Assistant", en: "Legal Assistant" },
    SECRETARY: { fr: "Secrétaire", en: "Secretary" },
    ACCOUNTANT: { fr: "Comptable", en: "Accountant" },
    ADMIN: { fr: "Administrateur Système", en: "System Administrator" },
    FUNCTIONAL_ADMIN: { fr: "Administrateur Fonctionnel", en: "Functional Admin" },
    TECHNICAL_ADMIN: { fr: "Administrateur Technique", en: "Technical Admin" },
  };

  const userRole = roleLabels[session.user.roleKey]
    ? (locale === "en" ? roleLabels[session.user.roleKey].en : roleLabels[session.user.roleKey].fr)
    : session.user.roleKey;

  return (
    <AppShell
      locale={locale}
      userName={session.user.name}
      userRoleLabel={userRole}
    >
      <div className="p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </AppShell>
  );
}

