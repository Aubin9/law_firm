import * as React from "react";
import { ArrowUp, Flag, Minus, ArrowDown } from "lucide-react";
import { StatusChip, type StatusTone } from "./status-chip";

export type PriorityLevel = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface PriorityChipProps {
  priority: PriorityLevel;
  locale?: "fr" | "en";
  className?: string;
}

const priorityMap: Record<
  PriorityLevel,
  {
    fr: string;
    en: string;
    tone: StatusTone;
    icon: React.ReactNode;
  }
> = {
  LOW: {
    fr: "Basse",
    en: "Low",
    tone: "neutral",
    icon: <ArrowDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />,
  },
  NORMAL: {
    fr: "Normale",
    en: "Normal",
    tone: "primary",
    icon: <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
  },
  HIGH: {
    fr: "Haute",
    en: "High",
    tone: "warning",
    icon: <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
  },
  URGENT: {
    fr: "Urgente",
    en: "Urgent",
    tone: "danger",
    icon: <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
  },
};

export function PriorityChip({
  priority,
  locale = "fr",
  className,
}: PriorityChipProps) {
  const config = priorityMap[priority] ?? priorityMap.NORMAL;
  return (
    <StatusChip
      label={locale === "en" ? config.en : config.fr}
      tone={config.tone}
      showDot={false}
      icon={config.icon}
      className={className}
    />
  );
}

