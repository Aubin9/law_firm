"use client";

import React from "react";
import { DeniedState } from "./denied-state";

interface DeniedBoundaryProps {
  error?: Error | null;
  locale?: "fr" | "en";
  backHref?: string;
}

export function DeniedBoundary({ error, locale = "fr", backHref }: DeniedBoundaryProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <DeniedState
        locale={locale}
        backHref={backHref}
        description={error?.message}
      />
    </div>
  );
}

