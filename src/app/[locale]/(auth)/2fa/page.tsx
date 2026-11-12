"use client";

import React, { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { ShieldCheck, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TwoFactorPage() {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "fr") as "fr" | "en";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    const char = cleaned.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    // Auto-advance to next input
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const targetIdx = Math.min(pasted.length, 5);
    inputRefs.current[targetIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (useBackup) {
        if (!backupCode.trim()) return;
        const res = await authClient.twoFactor.verifyBackupCode({
          code: backupCode.trim(),
        });
        if (res.error) {
          setError(res.error.message || t("invalidCode"));
          setIsLoading(false);
          return;
        }
      } else {
        const fullCode = digits.join("");
        if (fullCode.length < 6) {
          setError(t("codeLabel"));
          setIsLoading(false);
          return;
        }
        const res = await authClient.twoFactor.verifyTotp({
          code: fullCode,
        });
        if (res.error) {
          setError(res.error.message || t("invalidCode"));
          setIsLoading(false);
          return;
        }
      }

      router.push(`/${locale}/dashboard`);
    } catch (err: any) {
      setError(t("invalidCode"));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[420px] bg-white border border-[#E5E0D8] rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 text-primary mb-3 border border-[#E5E0D8]">
            {useBackup ? (
              <KeyRound className="w-6 h-6 text-gold" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-gold" />
            )}
          </div>
          <h1 className="font-serif text-xl font-semibold text-primary">
            {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {useBackup ? t("backupCodeLabel") : t("subtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-900">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!useBackup ? (
            <div>
              <Label className="block text-center text-xs font-semibold mb-3">
                {t("codeLabel")}
              </Label>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={isLoading}
                    className="w-11 h-12 text-center font-mono text-xl font-bold border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-primary bg-[#FAF9F6]"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="backupCode" className="text-xs font-semibold">
                {t("backupCodeLabel")}
              </Label>
              <Input
                id="backupCode"
                type="text"
                required
                autoFocus
                placeholder="ABCD-1234"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                disabled={isLoading}
                className="mt-1 font-mono uppercase tracking-widest text-center border-[#E5E0D8]"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || (!useBackup && digits.join("").length < 6)}
            className="w-full bg-primary hover:bg-primary/95 text-white font-medium py-2 rounded-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("submitButton")}...
              </span>
            ) : (
              t("submitButton")
            )}
          </Button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setUseBackup(!useBackup);
                setError(null);
              }}
              className="text-xs text-gold hover:underline font-medium"
            >
              {useBackup ? t("useTotpCode") : t("useBackupCode")}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#F0EBE1] text-center">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {locale === "fr" ? "Retour à la connexion" : "Back to login"}
          </Link>
        </div>
      </div>
    </div>
  );
}

