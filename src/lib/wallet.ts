/**
 * Wallet management — stores encrypted private key in chrome.storage.local.
 * Key never leaves the device.
 *
 * Karpathy principle: simplest possible key management for MVP.
 * Production would use a hardware wallet or MPC — not a raw private key.
 */

const KEY_STORAGE_KEY = "readpay_encrypted_key";
const ADDR_STORAGE_KEY = "readpay_address";

// Simple AES-GCM encryption using SubtleCrypto (available in extension context)
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptKey(privateKey: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(privateKey)
  );
  // Pack salt + iv + ciphertext as base64
  const combined = new Uint8Array([...salt, ...iv, ...new Uint8Array(ciphertext)]);
  return btoa(String.fromCharCode(...combined));
}

async function decryptKey(encrypted: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const cryptoKey = await deriveKey(password, salt);
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  return dec.decode(plaintext);
}

export async function saveWallet(
  privateKey: `0x${string}`,
  address: string,
  password: string
): Promise<void> {
  const encrypted = await encryptKey(privateKey, password);
  await chrome.storage.local.set({
    [KEY_STORAGE_KEY]: encrypted,
    [ADDR_STORAGE_KEY]: address,
  });
}

export async function loadPrivateKey(password: string): Promise<`0x${string}`> {
  const result = await chrome.storage.local.get([KEY_STORAGE_KEY]);
  const encrypted = result[KEY_STORAGE_KEY];
  if (!encrypted) throw new Error("No wallet found. Please set up ReadPay first.");
  const key = await decryptKey(encrypted, password);
  return key as `0x${string}`;
}

export async function getStoredAddress(): Promise<string | null> {
  const result = await chrome.storage.local.get([ADDR_STORAGE_KEY]);
  return result[ADDR_STORAGE_KEY] ?? null;
}

export async function hasWallet(): Promise<boolean> {
  const result = await chrome.storage.local.get([KEY_STORAGE_KEY]);
  return !!result[KEY_STORAGE_KEY];
}

export async function clearWallet(): Promise<void> {
  await chrome.storage.local.remove([KEY_STORAGE_KEY, ADDR_STORAGE_KEY]);
}
