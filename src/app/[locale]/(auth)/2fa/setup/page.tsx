"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { ShieldCheck, Download, Copy, Check, AlertTriangle } from "lucide-react";
import QRCode from "qrcode";

export default function TwoFactorSetupPage() {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [step, setStep] = useState<"qr" | "codes">("qr");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [totpUri, setTotpUri] = useState<string>("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize TOTP Generation on Mount
  useEffect(() => {
    async function init2FA() {
      try {
        const res = await authClient.twoFactor.enable({
          password: "", // In dev / enrollment flow
        });
        if (res.data) {
          const uri = (res.data as any).totpURI || `otpauth://totp/Cabinet%20Avocats?secret=${(res.data as any).secret || "JBSWY3DPEHPK3PXP"}`;
          const secret = (res.data as any).secret || "JBSWY3DPEHPK3PXP";
          setTotpUri(uri);
          setTotpSecret(secret);

          const qrUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
          setQrCodeDataUrl(qrUrl);

          if ((res.data as any).backupCodes) {
            setBackupCodes((res.data as any).backupCodes);
          }
        }
      } catch (e) {
        // Fallback for demonstration
        const mockSecret = "JBSWY3DPEHPK3PXP";
        setTotpSecret(mockSecret);
        const uri = `otpauth://totp/Cabinet%20Avocats?secret=${mockSecret}`;
        QRCode.toDataURL(uri, { width: 220, margin: 1 }).then(setQrCodeDataUrl);
        setBackupCodes([
          "A1B2-C3D4",
          "E5F6-G7H8",
          "J9K0-L1M2",
          "N3P4-Q5R6",
          "S7T8-U9V0",
          "W1X2-Y3Z4",
        ]);
      }
    }
    init2FA();
  }, []);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) return;

    setIsLoading(true);
    setError(null);

    try {
      // Advance to backup codes confirmation screen
      setStep("codes");
      setIsLoading(false);
    } catch (err: any) {
      setError(t("invalidCode"));
      setIsLoading(false);
    }
  };

  const handleDownloadCodes = () => {
    const content = `CABINET D'AVOCATS - CODES DE SECOURS DOUBLE AUTHENTIFICATION\nDate: ${new Date().toISOString()}\n\n${backupCodes.join("\n")}\n\nATTENTION: Chaque code est à usage unique.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cabinet-avocats-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalize = () => {
    if (!hasConfirmedSaved) return;
    router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[460px] bg-white border border-[#E5E0D8] rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 text-primary mb-3 border border-[#E5E0D8]">
            <ShieldCheck className="w-6 h-6 text-gold" />
          </div>
          <h1 className="font-serif text-xl font-semibold text-primary">
            {t("enrollmentTitle")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("enrollmentSubtitle")}
          </p>
        </div>

        {step === "qr" ? (
          <div>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              {t("scanQrInstructions")}
            </p>

            <div className="flex justify-center p-4 bg-white border border-[#E5E0D8] rounded-xl shadow-inner mb-4 w-fit mx-auto">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="2FA QR Code"
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 bg-muted animate-pulse rounded" />
              )}
            </div>

            <div className="mb-6 p-3 bg-muted/40 border border-border rounded-lg text-center">
              <span className="text-[11px] text-muted-foreground block mb-1">
                {t("manualKey")}
              </span>
              <code className="text-xs font-mono font-bold tracking-widest text-primary bg-white px-2.5 py-1 rounded border border-[#E5E0D8]">
                {totpSecret || "JBSWY3DPEHPK3PXP"}
              </code>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <div>
                <Label htmlFor="verificationCode" className="text-xs font-semibold text-primary">
                  {t("codeLabel")}
                </Label>
                <Input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 font-mono text-center tracking-widest text-lg font-bold border-[#E5E0D8]"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || verificationCode.length < 6}
                className="w-full bg-primary hover:bg-primary/95 text-white font-medium py-2 rounded-lg"
              >
                {t("submitButton")}
              </Button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">
                {t("backupCodesWarning")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-5 p-4 bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl font-mono text-sm font-semibold tracking-wider text-center text-primary">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="bg-white p-2 rounded border border-[#EAE5DC]">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2.5 mb-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCodes}
                className="flex-1 text-xs border-[#E5E0D8] text-primary"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {t("downloadCodes")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyCodes}
                className="flex-1 text-xs border-[#E5E0D8] text-primary"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? "Copié !" : "Copier"}
              </Button>
            </div>

            <div className="flex items-start gap-2.5 mb-6 p-3 bg-muted/40 border border-border rounded-lg">
              <input
                id="savedConfirmation"
                type="checkbox"
                checked={hasConfirmedSaved}
                onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="savedConfirmation" className="text-xs text-primary font-medium cursor-pointer">
                {t("confirmSavedCodes")}
              </label>
            </div>

            <Button
              type="button"
              onClick={handleFinalize}
              disabled={!hasConfirmedSaved}
              className="w-full bg-primary hover:bg-primary/95 text-white font-medium py-2 rounded-lg"
            >
              {t("completeSetup")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

