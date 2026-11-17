/**
 * Reversible redaction & data minimisation pipeline (CLAUDE.md §8, ARCHITECTURE.md §10, Loi n° 2024/017)
 * Redacts personal identifiers, telephone numbers, emails, bank accounts and national IDs
 * into reversible placeholders before transmitting text to external AI models.
 */

export interface RedactionResult {
  redactedText: string;
  placeholderMap: Record<string, string>; // placeholder -> original
}

// Regex patterns for sensitive data
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// International, French and Cameroonian phone formats (+237 6xx, 06 xx, etc.)
const PHONE_REGEX = /(?:\+237\s?|00237\s?)?(?:6[25789]\d{7}|2[234]\d{7})|(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

// Bank details: IBAN, Cameroonian RIB / Account patterns
const IBAN_OR_RIB_REGEX = /[A-Z]{2}\d{2}[A-Z0-9]{10,30}|\b\d{5}[-\s]?\d{5}[-\s]?\d{11}[-\s]?\d{2}\b/gi;

// Identity documents: Cameroonian CNI (9 or 10 digits), Passports
const ID_NUMBER_REGEX = /\b(?:CNI|PASSPORT|PASSEPORT|NIU)\s?[:#]?\s?([A-Z0-9]{7,14})\b/gi;

export function redactText(rawText: string, knownEntities: string[] = []): RedactionResult {
  if (!rawText) {
    return { redactedText: "", placeholderMap: {} };
  }

  let text = rawText;
  const placeholderMap: Record<string, string> = {};

  let personCounter = 1;
  let emailCounter = 1;
  let phoneCounter = 1;
  let bankCounter = 1;
  let idCounter = 1;

  // 1. Redact known entities (e.g. party names, client names, opposing counsel)
  for (const entity of knownEntities) {
    const trimmed = entity.trim();
    if (trimmed.length > 2) {
      const placeholder = `[PERSONNE_${personCounter++}]`;
      // Escape for regex
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      if (regex.test(text)) {
        placeholderMap[placeholder] = trimmed;
        text = text.replace(regex, placeholder);
      }
    }
  }

  // 2. Redact Emails
  text = text.replace(EMAIL_REGEX, (match) => {
    const placeholder = `[EMAIL_${emailCounter++}]`;
    placeholderMap[placeholder] = match;
    return placeholder;
  });

  // 3. Redact Phone Numbers
  text = text.replace(PHONE_REGEX, (match) => {
    const placeholder = `[TELEPHONE_${phoneCounter++}]`;
    placeholderMap[placeholder] = match;
    return placeholder;
  });

  // 4. Redact Bank Details & RIB/IBAN
  text = text.replace(IBAN_OR_RIB_REGEX, (match) => {
    const placeholder = `[COMPTE_BANCAIRE_${bankCounter++}]`;
    placeholderMap[placeholder] = match;
    return placeholder;
  });

  // 5. Redact IDs
  text = text.replace(ID_NUMBER_REGEX, (match) => {
    const placeholder = `[PIECE_IDENTITE_${idCounter++}]`;
    placeholderMap[placeholder] = match;
    return placeholder;
  });

  return {
    redactedText: text,
    placeholderMap,
  };
}

export function restoreText(redactedText: string, placeholderMap: Record<string, string>): string {
  if (!redactedText || !placeholderMap) return redactedText;

  let restored = redactedText;
  for (const [placeholder, original] of Object.entries(placeholderMap)) {
    // Replace all occurrences of placeholder
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restored = restored.replace(new RegExp(escaped, "g"), original);
  }

  return restored;
}

