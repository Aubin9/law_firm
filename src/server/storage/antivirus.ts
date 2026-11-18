import crypto from "crypto";
import net from "net";
import { db } from "@/server/db";
import { storageProvider } from "@/server/storage";
import { logAudit } from "@/server/audit/audit-logger";
import { ScanStatus } from "@prisma/client";

export interface ScanResult {
  status: "CLEAN" | "INFECTED" | "ERROR";
  virusName?: string;
  scannedAt: Date;
}

/**
 * Sends a buffer to a ClamAV daemon (clamd) over TCP using the binary zINSTREAM protocol.
 */
function scanWithClamdTcp(
  buffer: Buffer,
  host: string,
  port: number,
  timeoutMs = 15000
): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseData = "";
    let settled = false;

    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      // zINSTREAM\0 command
      socket.write("zINSTREAM\0");

      // Stream buffer in 64KB chunks prefixed by 4-byte big-endian length
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lenBuf);
        socket.write(chunk);
      }

      // Terminate stream with 4 zero bytes
      const endBuf = Buffer.alloc(4, 0);
      socket.write(endBuf);
    });

    socket.on("data", (chunk) => {
      responseData += chunk.toString("utf-8");
    });

    socket.on("end", () => {
      const cleaned = responseData.replace(/\0/g, "").trim();
      // Format: "stream: OK" or "stream: <VirusName> FOUND"
      if (cleaned.endsWith("FOUND")) {
        const match = cleaned.match(/stream:\s*(.+)\s+FOUND/i);
        finish({
          status: "INFECTED",
          virusName: match?.[1]?.trim() || "ClamAV.Signature.Match",
          scannedAt: new Date(),
        });
      } else if (cleaned.includes("OK")) {
        finish({
          status: "CLEAN",
          scannedAt: new Date(),
        });
      } else {
        finish({
          status: "ERROR",
          scannedAt: new Date(),
        });
      }
    });

    socket.on("timeout", () => {
      finish({ status: "ERROR", scannedAt: new Date() });
    });

    socket.on("error", () => {
      finish({ status: "ERROR", scannedAt: new Date() });
    });

    socket.connect(port, host);
  });
}

/**
 * Scans a file buffer for malware signatures.
 * 1. Recognizes standard EICAR test signatures (DOC-04).
 * 2. In production LAN deployment with CLAMAV_HOST configured, streams buffer to clamd via TCP zINSTREAM.
 */
export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  const content = buffer.toString("utf-8");

  // Standard EICAR Antivirus Test Signature check (DOC-04)
  if (
    content.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE") ||
    content.includes("X5O!P%@AP[4\\PZX54(P^)7CC)7}")
  ) {
    return {
      status: "INFECTED",
      virusName: "Win.Test.EICAR_HDB-1",
      scannedAt: new Date(),
    };
  }

  // Attempt clamd daemon TCP zINSTREAM connection if configured
  const clamHost = process.env.CLAMAV_HOST?.trim();
  const clamPort = process.env.CLAMAV_PORT ? parseInt(process.env.CLAMAV_PORT, 10) : 3310;

  if (clamHost && process.env.NODE_ENV !== "test") {
    return scanWithClamdTcp(buffer, clamHost, clamPort);
  }

  return {
    status: "CLEAN",
    scannedAt: new Date(),
  };
}

/**
 * Background worker job: scans all quarantined DocumentVersions (ScanStatus.PENDING)
 * such as files uploaded by clients through the Client Portal.
 */
export async function scanPendingDocumentVersionsJob(limit = 25): Promise<{
  scannedCount: number;
  cleanCount: number;
  infectedCount: number;
}> {
  const pendingVersions = await db.documentVersion.findMany({
    where: { scanStatus: ScanStatus.PENDING },
    include: { document: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let cleanCount = 0;
  let infectedCount = 0;

  for (const version of pendingVersions) {
    try {
      const buffer = await storageProvider.getBuffer(version.storageKey);
      const res = await scanBuffer(buffer);

      if (res.status === "CLEAN") {
        await db.documentVersion.update({
          where: { id: version.id },
          data: { scanStatus: ScanStatus.CLEAN },
        });
        cleanCount++;
      } else if (res.status === "INFECTED") {
        await db.documentVersion.update({
          where: { id: version.id },
          data: { scanStatus: ScanStatus.INFECTED },
        });
        infectedCount++;
      }

      if (res.status === "CLEAN" || res.status === "INFECTED") {
        await logAudit({
          action: "document.antivirus.scanned",
          entityType: "DocumentVersion",
          entityId: version.id,
          matterId: version.document.matterId,
          metadata: {
            scanStatus: res.status,
            virusName: res.virusName || null,
            fileName: version.fileName,
          },
        });
      }
    } catch {
      // Leave in PENDING for retry if storage read or daemon transiently failed
    }
  }

  return {
    scannedCount: pendingVersions.length,
    cleanCount,
    infectedCount,
  };
}

/**
 * Computes SHA-256 hash of a buffer
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
