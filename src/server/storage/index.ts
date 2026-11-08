// StorageProvider interface and local / cloudflare implementations
export interface StorageProvider {
  put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

