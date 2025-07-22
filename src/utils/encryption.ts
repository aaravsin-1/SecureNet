// Use Web Crypto API for client-side encryption

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Derives an encryption key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-256-GCM
 */
export async function encryptData(data: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const key = await deriveKey(password, salt);
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoder.encode(data)
    );

    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Return base64 encoded string with prefix to identify encrypted data
    return 'ENC:' + btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data using AES-256-GCM
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    // Check if data is encrypted
    if (!encryptedData.startsWith('ENC:')) {
      return encryptedData; // Return as-is if not encrypted
    }

    const data = encryptedData.slice(4); // Remove 'ENC:' prefix
    const combined = new Uint8Array(
      atob(data).split('').map(char => char.charCodeAt(0))
    );

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid password or corrupted data');
  }
}

/**
 * Checks if data is encrypted
 */
export function isEncrypted(data: string): boolean {
  return data.startsWith('ENC:');
}

/**
 * Generate a secure random password for encryption
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Encrypt object properties
 */
export async function encryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[],
  password: string
): Promise<T> {
  const result = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    if (result[field] && typeof result[field] === 'string') {
      (result[field] as any) = await encryptData(result[field] as string, password);
    }
  }
  
  return result;
}

/**
 * Decrypt object properties
 */
export async function decryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[],
  password: string
): Promise<T> {
  const result = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        (result[field] as any) = await decryptData(result[field] as string, password);
      } catch (error) {
        console.warn(`Failed to decrypt field ${String(field)}:`, error);
        // Keep original value if decryption fails
      }
    }
  }
  
  return result;
}
