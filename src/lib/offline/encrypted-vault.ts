/**
 * Encrypted Offline Vault using Web Crypto API (AES-256-GCM) and IndexedDB (EXT-03)
 * Guarantees zero plaintext exposure of confidential lawyer matter data on device disk.
 */

const DB_NAME = "lawfirm_offline_vault";
const DB_VERSION = 1;
const STORE_NAME = "encrypted_records";

// Open or initialize IndexedDB
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Derive AES-256-GCM key from session/device secret using PBKDF2
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayload {
  key: string;
  iv: number[];
  salt: number[];
  ciphertext: number[];
  updatedAt: string;
}

/**
 * Encrypt and store data in IndexedDB
 */
export async function vaultSet<T>(key: string, data: T, secret: string): Promise<void> {
  const db = await openVaultDB();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await deriveKey(secret, salt);

  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encodedData
  );

  const payload: EncryptedPayload = {
    key,
    iv: Array.from(iv),
    salt: Array.from(salt),
    ciphertext: Array.from(new Uint8Array(encryptedBuffer)),
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(payload);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Read and decrypt data from IndexedDB
 */
export async function vaultGet<T>(key: string, secret: string): Promise<T | null> {
  const db = await openVaultDB();

  const record = await new Promise<EncryptedPayload | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!record) return null;

  try {
    const salt = new Uint8Array(record.salt);
    const iv = new Uint8Array(record.iv);
    const ciphertext = new Uint8Array(record.ciphertext);
    const cryptoKey = await deriveKey(secret, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuffer)) as T;
  } catch (err) {
    console.warn("[Vault] Decryption failed (invalid key or corrupted entry):", err);
    return null;
  }
}

/**
 * Scrub all offline data immediately (Remote Wipe / Session Revocation)
 */
export async function clearOfflineVault(): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    localStorage.removeItem("lawfirm_offline_synced_at");
  } catch (err) {
    console.warn("[Vault] Clear failed:", err);
  }
}
