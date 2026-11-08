import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.join(process.cwd(), "src", "messages");
const FR_DIR = path.join(MESSAGES_DIR, "fr");
const EN_DIR = path.join(MESSAGES_DIR, "en");

function getKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkParity(): void {
  console.log("🌐 Running i18n parity check between French (default) and English...");

  if (!fs.existsSync(FR_DIR) || !fs.existsSync(EN_DIR)) {
    console.error("❌ Missing translation directories (src/messages/fr or src/messages/en)");
    process.exit(1);
  }

  const frFiles = fs.readdirSync(FR_DIR).filter((f) => f.endsWith(".json"));
  const enFiles = fs.readdirSync(EN_DIR).filter((f) => f.endsWith(".json"));

  let hasError = false;

  // Check file presence
  const allNamespaces = Array.from(new Set([...frFiles, ...enFiles]));

  for (const ns of allNamespaces) {
    const frPath = path.join(FR_DIR, ns);
    const enPath = path.join(EN_DIR, ns);

    if (!fs.existsSync(frPath)) {
      console.error(`❌ Namespace "${ns}" exists in EN but is missing in FR!`);
      hasError = true;
      continue;
    }

    if (!fs.existsSync(enPath)) {
      console.error(`❌ Namespace "${ns}" exists in FR but is missing in EN!`);
      hasError = true;
      continue;
    }

    const frContent = JSON.parse(fs.readFileSync(frPath, "utf-8"));
    const enContent = JSON.parse(fs.readFileSync(enPath, "utf-8"));

    const frKeys = new Set(getKeys(frContent));
    const enKeys = new Set(getKeys(enContent));

    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k));
    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));

    if (missingInEn.length > 0) {
      hasError = true;
      console.error(`\n❌ [${ns}] Missing in English (en):`);
      for (const k of missingInEn) {
        console.error(`   - ${k}`);
      }
    }

    if (missingInFr.length > 0) {
      hasError = true;
      console.error(`\n❌ [${ns}] Missing in French (fr):`);
      for (const k of missingInFr) {
        console.error(`   - ${k}`);
      }
    }
  }

  if (hasError) {
    console.error("\n❌ i18n parity check failed! Please synchronize keys.");
    process.exit(1);
  }

  console.log(`✅ All ${allNamespaces.length} namespaces are 100% in sync between FR and EN!`);
}

checkParity();

