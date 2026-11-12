"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SidePanel } from "@/components/app/side-panel";
import {
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  LogOut,
  Copy,
  Check,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  getUsersAction,
  createUserAction,
  setUserStatusAction,
  revokeUserSessionsAction,
} from "@/server/actions/user-admin-actions";

export default function UsersAdminPage() {
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdPasswordInfo, setCreatedPasswordInfo] = useState<{
    name: string;
    email: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("LEAD_LAWYER");
  const [newLocale, setNewLocale] = useState("FR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Revoke modal state
  const [revokeUserId, setRevokeUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await getUsersAction();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      // Find roleId for newRole
      const roleItem = users.find((u) => u.role.key === newRole)?.role;
      const roleId = roleItem?.id || "role_lead";

      const res = await createUserAction({
        name: newName,
        email: newEmail,
        roleId,
        locale: newLocale as any,
      });

      setIsCreateOpen(false);
      setCreatedPasswordInfo({
        name: res.user.name,
        email: res.user.email,
        tempPass: res.temporaryPassword,
      });
      setNewName("");
      setNewEmail("");
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await setUserStatusAction(userId, nextStatus as any);
      setMessage(
        locale === "fr"
          ? `Statut du compte mis à jour (${nextStatus}).`
          : `Account status updated (${nextStatus}).`
      );
      loadUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeSessions = async () => {
    if (!revokeUserId) return;
    try {
      const res = await revokeUserSessionsAction(revokeUserId);
      setMessage(
        locale === "fr"
          ? `${res.revokedCount} session(s) active(s) révoquée(s).`
          : `${res.revokedCount} active session(s) revoked.`
      );
      setRevokeUserId(null);
      loadUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.nameFr.toLowerCase().includes(q) ||
      u.role.nameEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "fr" ? "Gestion des utilisateurs" : "User Management"}
        description={
          locale === "fr"
            ? "Administration des comptes, des rôles et des habilitations de sécurité du cabinet."
            : "Administration of law practice user accounts, roles, and security credentials."
        }
          actions={
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {locale === "fr" ? "Créer un utilisateur" : "New User"}
            </Button>
          }
        />

        {message && (
          <div className="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2.5 text-xs text-green-900 font-medium">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {message}
          </div>
        )}

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-white p-3 border border-[#E5E0D8] rounded-xl shadow-sm">
          <Search className="w-4 h-4 text-muted-foreground ml-1" />
          <input
            type="text"
            placeholder={
              locale === "fr"
                ? "Rechercher par nom, email ou rôle..."
                : "Search by name, email, or role..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D8] bg-[#FAF9F6] text-muted-foreground font-semibold">
                <th className="py-3 px-4">{locale === "fr" ? "Utilisateur" : "User"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Rôle" : "Role"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Statut" : "Status"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "2FA" : "2FA"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Sessions" : "Sessions"}</th>
                <th className="py-3 px-4">{locale === "fr" ? "Dernière connexion" : "Last Login"}</th>
                <th className="py-3 px-4 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAF9F6]/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-primary">
                      <div>
                        <span className="font-semibold">{u.name}</span>
                        <span className="block text-[11px] text-muted-foreground font-mono">
                          {u.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-primary">
                      <Badge variant="outline" className="text-[11px] border-[#E5E0D8] bg-white">
                        {locale === "fr" ? u.role.nameFr : u.role.nameEn}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === "ACTIVE" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
                          {locale === "fr" ? "Actif" : "Active"}
                        </span>
                      ) : u.status === "SUSPENDED" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {locale === "fr" ? "Suspendu" : "Suspended"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          {locale === "fr" ? "Désactivé" : "Disabled"}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {locale === "fr" ? "Actif" : "Enabled"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {locale === "fr" ? "Non activé" : "Disabled"}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {u._count.sessions} {locale === "fr" ? "active(s)" : "active"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString(
                            locale === "fr" ? "fr-FR" : "en-US",
                            { dateStyle: "short", timeStyle: "short" }
                          )
                        : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u._count.sessions > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeUserId(u.id)}
                            title={locale === "fr" ? "Révoquer les sessions" : "Revoke sessions"}
                            className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50"
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1" />
                            {locale === "fr" ? "Déconnecter" : "Revoke"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`h-7 px-2 text-xs ${
                            u.status === "ACTIVE"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {u.status === "ACTIVE"
                            ? locale === "fr"
                              ? "Désactiver"
                              : "Disable"
                            : locale === "fr"
                            ? "Activer"
                            : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      {/* Create User SidePanel */}
      <SidePanel
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={locale === "fr" ? "Nouveau collaborateur" : "New Team Member"}
        subtitle={
          locale === "fr"
            ? "Créer un nouveau compte utilisateur avec attribution de rôle."
            : "Create a new user account with role assignment."
        }
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 font-medium">
              {formError}
            </div>
          )}

          <div>
            <Label htmlFor="create-name" className="text-xs font-semibold">
              {locale === "fr" ? "Nom complet et titre" : "Full Name & Title"}
            </Label>
            <Input
              id="create-name"
              required
              placeholder="Me Alain NANA"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 text-xs border-[#E5E0D8]"
            />
          </div>

          <div>
            <Label htmlFor="create-email" className="text-xs font-semibold">
              {locale === "fr" ? "Adresse email professionnelle" : "Professional Email"}
            </Label>
            <Input
              id="create-email"
              type="email"
              required
              placeholder="a.nana@cabinet-avocats.cm"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1 text-xs border-[#E5E0D8]"
            />
          </div>

          <div>
            <Label htmlFor="create-role" className="text-xs font-semibold">
              {locale === "fr" ? "Rôle au sein du cabinet" : "Law Practice Role"}
            </Label>
            <select
              id="create-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="mt-1 w-full text-xs border border-[#E5E0D8] rounded-lg p-2 bg-white text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="PARTNER">Associé / Responsable du cabinet</option>
              <option value="LEAD_LAWYER">Avocat responsable de dossier</option>
              <option value="ASSOCIATE_LAWYER">Avocat collaborateur</option>
              <option value="SECRETARY">Assistant juridique / Secrétariat</option>
              <option value="ACCOUNTANT">Comptable</option>
              <option value="FUNCTIONAL_ADMIN">Administrateur fonctionnel</option>
              <option value="TECHNICAL_ADMIN">Administrateur technique</option>
            </select>
          </div>

          <div>
            <Label htmlFor="create-locale" className="text-xs font-semibold">
              {locale === "fr" ? "Langue par défaut" : "Default Language"}
            </Label>
            <select
              id="create-locale"
              value={newLocale}
              onChange={(e) => setNewLocale(e.target.value)}
              className="mt-1 w-full text-xs border border-[#E5E0D8] rounded-lg p-2 bg-white text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="FR">Français (FR)</option>
              <option value="EN">English (EN)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#F0EBE1] flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="text-xs"
            >
              {locale === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold"
            >
              {isSubmitting
                ? locale === "fr"
                  ? "Création..."
                  : "Creating..."
                : locale === "fr"
                ? "Générer les accès"
                : "Create Account"}
            </Button>
          </div>
        </form>
      </SidePanel>

      {/* One-Time Temporary Password Modal */}
      {createdPasswordInfo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary">
                  {locale === "fr" ? "Identifiants temporaires créés" : "Temporary Credentials Generated"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {createdPasswordInfo.name} ({createdPasswordInfo.email})
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {locale === "fr"
                  ? "Ce mot de passe temporaire ne sera affiché qu'une seule fois. Veuillez le transmettre de manière sécurisée au collaborateur."
                  : "This temporary password will be displayed once only. Please transmit it securely to the user."}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#FAF9F6] border border-[#E5E0D8] rounded-lg font-mono text-sm font-bold text-primary mb-5">
              <span>{createdPasswordInfo.tempPass}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdPasswordInfo.tempPass);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="h-8 text-xs border-[#E5E0D8]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1">{copied ? "Copié" : "Copier"}</span>
              </Button>
            </div>

            <Button
              onClick={() => setCreatedPasswordInfo(null)}
              className="w-full bg-primary hover:bg-primary/95 text-white text-xs font-semibold"
            >
              {locale === "fr" ? "J'ai bien noté le mot de passe" : "I have saved the password"}
            </Button>
          </div>
        </div>
      )}

      {/* Revoke Sessions Confirmation */}
      <ConfirmDialog
        open={!!revokeUserId}
        onOpenChange={(open) => {
          if (!open) setRevokeUserId(null);
        }}
        onConfirm={handleRevokeSessions}
        title={locale === "fr" ? "Révoquer toutes les sessions ?" : "Revoke all sessions?"}
        consequence={
          locale === "fr"
            ? "L'utilisateur sera immédiatement déconnecté de tous ses appareils (LAN et VPN)."
            : "The user will be immediately signed out from all connected devices (LAN and VPN)."
        }
        confirmLabel={locale === "fr" ? "Déconnecter l'utilisateur" : "Revoke sessions"}
        destructive={true}
      />
    </div>
  );
}
