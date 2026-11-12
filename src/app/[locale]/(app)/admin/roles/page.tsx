"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS_MATRIX,
  RoleKey,
} from "@/server/auth/permission-matrix";
import { ShieldCheck, Check, Minus, Search, Info } from "lucide-react";

export default function RolesMatrixPage() {
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { key: "all", labelFr: "Toutes les catégories", labelEn: "All categories" },
    { key: "admin", labelFr: "3.1 Administration", labelEn: "3.1 Administration" },
    { key: "party", labelFr: "3.2 Parties & Prospects", labelEn: "3.2 Parties & Prospects" },
    { key: "conflict", labelFr: "3.2 Conflits d'intérêts", labelEn: "3.2 Conflict of Interest" },
    { key: "matter", labelFr: "3.3 Dossiers & Procédures", labelEn: "3.3 Matters & Procedures" },
    { key: "calendar", labelFr: "3.4 Calendrier & Délais", labelEn: "3.4 Calendar & Deadlines" },
    { key: "task", labelFr: "3.4 Tâches & Validation", labelEn: "3.4 Tasks & Validation" },
    { key: "document", labelFr: "3.5 Documents & Pièces", labelEn: "3.5 Documents & Files" },
    { key: "finance", labelFr: "3.6 Finance & Honoraires", labelEn: "3.6 Finance & Fees" },
    { key: "reporting", labelFr: "3.7 Tableaux de bord", labelEn: "3.7 Dashboards" },
    { key: "audit", labelFr: "3.7 Audit & Traçabilité", labelEn: "3.7 Audit & Logs" },
    { key: "retention", labelFr: "3.7 Archivage & Rétention", labelEn: "3.7 Retention" },
    { key: "security", labelFr: "3.7 Sécurité & Accès", labelEn: "3.7 Security & Access" },
    { key: "ai", labelFr: "3.7 Assistance IA", labelEn: "3.7 AI Assistance" },
  ];

  const rolesList: RoleKey[] = [
    "PARTNER",
    "LEAD_LAWYER",
    "ASSOCIATE_LAWYER",
    "SECRETARY",
    "ACCOUNTANT",
    "FUNCTIONAL_ADMIN",
    "TECHNICAL_ADMIN",
  ];

  const filteredPermissions = PERMISSION_DEFINITIONS.filter((p) => {
    const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.key.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Matrice des rôles et habilitations" : "Role & Permission Matrix"}
        description={
          locale === "fr"
            ? "Cartographie officielle des droits d'accès par rôle (PERMISSIONS.md). Source immuable de vérité."
            : "Official mapping of access rights per canonical role (PERMISSIONS.md). Immutable source of truth."
        }
      />

        {/* Regulatory Banner */}
        <div className="p-3.5 bg-muted/50 border border-border rounded-xl flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {locale === "fr"
              ? "Conformément aux règles du cabinet et au secret professionnel, les permissions sont strictement cloisonnées. Aucun utilisateur ne peut modifier son propre rôle. Les accès exceptionnels de l'administrateur technique font l'objet d'un accord exprès et d'une journalisation intégrale."
              : "In accordance with law practice rules and legal privilege, permissions are strictly partitioned. No user may alter their own role. Technical administrator exceptional accesses require explicit approval and are fully audit-logged."}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-white p-2.5 border border-[#E5E0D8] rounded-xl shadow-sm">
            <Search className="w-4 h-4 text-muted-foreground ml-1" />
            <input
              type="text"
              placeholder={
                locale === "fr"
                  ? "Filtrer une permission (ex: conflict.waive, task.validate)..."
                  : "Filter permission key or description..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-primary placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-[#E5E0D8] rounded-xl p-2.5 bg-white text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {locale === "fr" ? c.labelFr : c.labelEn}
              </option>
            ))}
          </select>
        </div>

        {/* Matrix Table */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D8] bg-[#FAF9F6]">
                <th className="py-3 px-4 font-semibold text-primary min-w-[280px]">
                  {locale === "fr" ? "Permission & Clé technique" : "Permission & Key"}
                </th>
                {rolesList.map((rk) => (
                  <th
                    key={rk}
                    className="py-3 px-3 text-center font-semibold text-primary min-w-[100px] border-l border-[#EBE6DE]"
                  >
                    <span className="block font-bold">
                      {rk === "PARTNER"
                        ? "Assoc."
                        : rk === "LEAD_LAWYER"
                        ? "Resp."
                        : rk === "ASSOCIATE_LAWYER"
                        ? "Collab."
                        : rk === "SECRETARY"
                        ? "Secr."
                        : rk === "ACCOUNTANT"
                        ? "Compt."
                        : rk === "FUNCTIONAL_ADMIN"
                        ? "Adm.F"
                        : "Adm.T"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {rk}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1]">
              {filteredPermissions.map((perm) => (
                <tr key={perm.key} className="hover:bg-[#FAF9F6]/60 transition-colors">
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-primary block">
                      {perm.description}
                    </span>
                    <code className="text-[11px] font-mono text-muted-foreground">
                      {perm.key}
                    </code>
                  </td>

                  {rolesList.map((rk) => {
                    const isGranted = (ROLE_PERMISSIONS_MATRIX[rk] as readonly string[]).includes(perm.key);
                    return (
                      <td
                        key={rk}
                        className="py-2.5 px-3 text-center border-l border-[#EBE6DE]"
                      >
                        {isGranted ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-700">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground/30">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}

