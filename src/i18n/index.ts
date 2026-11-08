export const locales = ["fr", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "fr";

export const namespaces = [
  "common",
  "auth",
  "shell",
  "dashboard",
  "matter",
  "party",
  "task",
  "document",
  "event",
  "audit",
  "errors",
] as const;

export type AppNamespace = (typeof namespaces)[number];

export async function getMessagesForLocale(locale: AppLocale) {
  const messages: Record<string, any> = {};
  for (const ns of namespaces) {
    try {
      const module = await import(`@/messages/${locale}/${ns}.json`);
      messages[ns] = module.default;
    } catch {
      // fallback or placeholder
    }
  }
  return messages;
}
