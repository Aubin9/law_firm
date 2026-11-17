export interface ParsedEmailAttachment {
  filename: string;
  contentType: string;
  buffer: Buffer;
  sizeBytes: number;
}

export interface ParsedEmail {
  from: string;
  fromEmail: string;
  to: string;
  cc?: string;
  subject: string;
  date: Date;
  bodyText: string;
  attachments: ParsedEmailAttachment[];
}

/**
 * Decodes MIME encoded-word syntax (=?charset?encoding?encoded_text?=).
 */
export function decodeMimeWord(word: string): string {
  return word.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_match: string, charset: string, encoding: string, text: string) => {
    try {
      if (encoding.toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString(charset.toLowerCase() === "utf-8" ? "utf-8" : "latin1");
      } else if (encoding.toUpperCase() === "Q") {
        const decoded = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decoded;
      }
      return text;
    } catch {
      return text;
    }
  });
}

/**
 * Decodes Quoted-Printable text.
 */
export function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return `=${hex}`;
      }
    });
}

/**
 * Extracts pure email address from "Display Name <email@domain.com>" or "email@domain.com".
 */
export function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  const directMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (directMatch) return directMatch[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

/**
 * Pure TypeScript RFC 822 / MIME parser for .eml files.
 */
export function parseEml(emlContent: string | Buffer): ParsedEmail {
  const content = Buffer.isBuffer(emlContent)
    ? emlContent.toString("latin1") // preserve binary bytes in strings before base64 decode
    : emlContent;

  // Split headers and body at the first double newline
  const headerBodySplit = content.search(/\r?\n\r?\n/);
  if (headerBodySplit === -1) {
    throw new Error("Format .eml invalide : aucun séparateur d'en-têtes et de corps trouvé.");
  }

  const headerRaw = content.slice(0, headerBodySplit);
  const bodyRaw = content.slice(headerBodySplit).replace(/^\r?\n\r?\n/, "");

  // Unfold multiline headers (RFC 822: headers beginning with whitespace are continuations)
  const unfoldedHeaders = headerRaw.replace(/\r?\n[ \t]+/g, " ");
  const headerLines = unfoldedHeaders.split(/\r?\n/);

  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const colonPos = line.indexOf(":");
    if (colonPos !== -1) {
      const key = line.slice(0, colonPos).trim().toLowerCase();
      const val = line.slice(colonPos + 1).trim();
      headers[key] = val;
    }
  }

  const from = decodeMimeWord(headers["from"] || "Inconnu");
  const fromEmail = extractEmailAddress(from);
  const to = decodeMimeWord(headers["to"] || "");
  const cc = headers["cc"] ? decodeMimeWord(headers["cc"]) : undefined;
  const subject = decodeMimeWord(headers["subject"] || "(Sans objet)");

  let date = new Date();
  if (headers["date"]) {
    const parsedDate = new Date(headers["date"]);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  }

  const contentTypeHeader = headers["content-type"] || "text/plain";
  const attachments: ParsedEmailAttachment[] = [];
  let bodyText = "";

  // Check for multipart
  const boundaryMatch = contentTypeHeader.match(/boundary=["']?([^"';]+)["']?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = bodyRaw.split(new RegExp(`--${boundary}(?:--)?`));

    for (const part of parts) {
      const trimmedPart = part.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
      if (!trimmedPart || trimmedPart.startsWith("--")) continue;

      const partSplit = trimmedPart.search(/\r?\n\r?\n/);
      if (partSplit === -1) continue;

      const partHeaderRaw = trimmedPart.slice(0, partSplit).replace(/\r?\n[ \t]+/g, " ");
      const partBodyRaw = trimmedPart.slice(partSplit).replace(/^\r?\n\r?\n/, "");

      const partHeaders: Record<string, string> = {};
      for (const line of partHeaderRaw.split(/\r?\n/)) {
        const colon = line.indexOf(":");
        if (colon !== -1) {
          partHeaders[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      }

      const partContentType = partHeaders["content-type"] || "text/plain";
      const partContentDisposition = partHeaders["content-disposition"] || "";
      const transferEncoding = (partHeaders["content-transfer-encoding"] || "").toLowerCase();

      // Check for filename
      const filenameMatch =
        partContentDisposition.match(/filename=["']?([^"';]+)["']?/i) ||
        partContentType.match(/name=["']?([^"';]+)["']?/i);

      if (filenameMatch || partContentDisposition.toLowerCase().includes("attachment")) {
        const filename = decodeMimeWord(filenameMatch ? filenameMatch[1] : `piece_jointe_${attachments.length + 1}`);
        let attBuffer: Buffer;

        if (transferEncoding === "base64") {
          const cleanB64 = partBodyRaw.replace(/\s+/g, "");
          attBuffer = Buffer.from(cleanB64, "base64");
        } else {
          attBuffer = Buffer.from(partBodyRaw, "binary");
        }

        attachments.push({
          filename,
          contentType: partContentType.split(";")[0].trim(),
          buffer: attBuffer,
          sizeBytes: attBuffer.length,
        });
      } else if (partContentType.toLowerCase().includes("text/plain")) {
        let text = partBodyRaw;
        if (transferEncoding === "base64") {
          text = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf-8");
        } else if (transferEncoding === "quoted-printable") {
          text = decodeQuotedPrintable(text);
        }
        bodyText += (bodyText ? "\n\n" : "") + text.trim();
      } else if (!bodyText && partContentType.toLowerCase().includes("text/html")) {
        // Fallback simple HTML body: strip basic tags
        let text = partBodyRaw;
        if (transferEncoding === "base64") {
          text = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf-8");
        } else if (transferEncoding === "quoted-printable") {
          text = decodeQuotedPrintable(text);
        }
        const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        bodyText += (bodyText ? "\n\n" : "") + stripped;
      }
    }
  } else {
    // Single-part email
    const transferEncoding = (headers["content-transfer-encoding"] || "").toLowerCase();
    let text = bodyRaw;
    if (transferEncoding === "base64") {
      text = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf-8");
    } else if (transferEncoding === "quoted-printable") {
      text = decodeQuotedPrintable(text);
    }
    bodyText = text.trim();
  }

  return {
    from,
    fromEmail,
    to,
    cc,
    subject,
    date,
    bodyText: bodyText || "(Corps de message vide)",
    attachments,
  };
}
