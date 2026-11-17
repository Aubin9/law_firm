import zlib from "zlib";

/**
 * Standard CRC-32 precomputed table (IEEE 802.3).
 */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(d: Date = new Date()): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f);
  const year = Math.max(0, d.getFullYear() - 1980) & 0x7f;
  const month = (d.getMonth() + 1) & 0x0f;
  const day = d.getDate() & 0x1f;
  const date = (year << 9) | (month << 5) | day;
  return { time, date };
}

interface ZipEntry {
  filename: string;
  data: Buffer;
  crc: number;
  compressedData: Buffer;
  compressionMethod: number;
  dosDate: number;
  dosTime: number;
  localHeaderOffset: number;
}

/**
 * Zero-dependency, pure TypeScript PKZIP 2.0 archive builder (NF-11 / NF-12).
 * Formats a fully standard .zip binary archive streamable directly over HTTP or saved to disk.
 */
export class ZipArchiveBuilder {
  private entries: Array<{
    filename: string;
    buffer: Buffer;
    date: Date;
  }> = [];

  /**
   * Adds a file to the archive.
   * Path should use forward slashes (e.g. "pieces/Actes/acte_v1.pdf").
   */
  addFile(pathInZip: string, content: Buffer | string, date: Date = new Date()): this {
    // Normalise path (no leading slash, forward slashes)
    const normalised = pathInZip.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
    this.entries.push({
      filename: normalised,
      buffer,
      date,
    });
    return this;
  }

  /**
   * Compiles the complete ZIP binary buffer.
   */
  build(): Buffer {
    const localHeadersAndData: Buffer[] = [];
    const processedEntries: ZipEntry[] = [];
    let currentOffset = 0;

    // 1. Process local headers and file payloads
    for (const entry of this.entries) {
      const { time, date } = toDosDateTime(entry.date);
      const crc = calculateCrc32(entry.buffer);

      // Attempt DEFLATE compression
      let compressed = entry.buffer;
      let method = 0; // STORE
      try {
        const deflated = zlib.deflateRawSync(entry.buffer);
        if (deflated.length < entry.buffer.length) {
          compressed = deflated;
          method = 8; // DEFLATE
        }
      } catch {
        // Fallback to STORE
        compressed = entry.buffer;
        method = 0;
      }

      const filenameBuffer = Buffer.from(entry.filename, "utf-8");

      // Local File Header (30 bytes + filename length)
      const lfh = Buffer.alloc(30);
      lfh.writeUInt32LE(0x04034b50, 0); // signature
      lfh.writeUInt16LE(20, 4); // version needed (2.0)
      lfh.writeUInt16LE(0x0800, 6); // UTF-8 filename flag (bit 11)
      lfh.writeUInt16LE(method, 8); // compression method
      lfh.writeUInt16LE(time, 10);
      lfh.writeUInt16LE(date, 12);
      lfh.writeUInt32LE(crc, 14);
      lfh.writeUInt32LE(compressed.length, 18);
      lfh.writeUInt32LE(entry.buffer.length, 22);
      lfh.writeUInt16LE(filenameBuffer.length, 26);
      lfh.writeUInt16LE(0, 28); // extra field length

      const entryLocalChunk = Buffer.concat([lfh, filenameBuffer, compressed]);
      localHeadersAndData.push(entryLocalChunk);

      processedEntries.push({
        filename: entry.filename,
        data: entry.buffer,
        crc,
        compressedData: compressed,
        compressionMethod: method,
        dosDate: date,
        dosTime: time,
        localHeaderOffset: currentOffset,
      });

      currentOffset += entryLocalChunk.length;
    }

    // 2. Central Directory
    const centralDirectoryStartOffset = currentOffset;
    const centralDirectoryHeaders: Buffer[] = [];

    for (const entry of processedEntries) {
      const filenameBuffer = Buffer.from(entry.filename, "utf-8");

      // Central Directory Header (46 bytes + filename length)
      const cdh = Buffer.alloc(46);
      cdh.writeUInt32LE(0x02014b50, 0); // signature
      cdh.writeUInt16LE(20, 4); // version made by (2.0)
      cdh.writeUInt16LE(20, 6); // version needed (2.0)
      cdh.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
      cdh.writeUInt16LE(entry.compressionMethod, 10);
      cdh.writeUInt16LE(entry.dosTime, 12);
      cdh.writeUInt16LE(entry.dosDate, 14);
      cdh.writeUInt32LE(entry.crc, 16);
      cdh.writeUInt32LE(entry.compressedData.length, 20);
      cdh.writeUInt32LE(entry.data.length, 24);
      cdh.writeUInt16LE(filenameBuffer.length, 28);
      cdh.writeUInt16LE(0, 30); // extra field length
      cdh.writeUInt16LE(0, 32); // comment length
      cdh.writeUInt16LE(0, 34); // disk number start
      cdh.writeUInt16LE(0, 36); // internal file attributes
      cdh.writeUInt32LE(0, 38); // external file attributes
      cdh.writeUInt32LE(entry.localHeaderOffset, 42);

      centralDirectoryHeaders.push(Buffer.concat([cdh, filenameBuffer]));
    }

    const centralDirectoryBuffer = Buffer.concat(centralDirectoryHeaders);
    const centralDirectorySize = centralDirectoryBuffer.length;

    // 3. End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // start disk
    eocd.writeUInt16LE(processedEntries.length, 8); // records on disk
    eocd.writeUInt16LE(processedEntries.length, 10); // total records
    eocd.writeUInt32LE(centralDirectorySize, 12); // size of central directory
    eocd.writeUInt32LE(centralDirectoryStartOffset, 16); // offset of central directory
    eocd.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([
      ...localHeadersAndData,
      centralDirectoryBuffer,
      eocd,
    ]);
  }
}

