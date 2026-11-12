import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import fs from "fs";
import path from "path";

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const targetLocale: string =
    locale && routing.locales.includes(locale as any)
      ? (locale as string)
      : routing.defaultLocale;

  // Load and merge all namespace files from src/messages/[locale]/*.json
  const messagesDir = path.join(process.cwd(), "src", "messages", targetLocale);
  const messages: Record<string, any> = {};

  if (fs.existsSync(messagesDir)) {
    const files = fs.readdirSync(messagesDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const namespace = file.replace(/\.json$/, "");
        const filePath = path.join(messagesDir, file);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          messages[namespace] = content;
        } catch (err) {
          console.error(`Error loading translation file ${filePath}:`, err);
        }
      }
    }
  }

  return {
    locale: targetLocale,
    messages,
    timeZone: "Africa/Douala",
  };
});

