// End-to-end encryption utilities using AES-GCM
export class E2EEncryption {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a random encryption key
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Derive key from password
  static async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Export key to base64 for storage
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // Import key from base64
  static async importKey(keyData: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      raw,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt text data
  static async encryptText(text: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = this.encoder.encode(text);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt text data
  static async decryptText(encryptedData: string, key: CryptoKey): Promise<string> {
    try {
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        data
      );

      return this.decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Generate random salt
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  // Convert salt to base64
  static saltToBase64(salt: Uint8Array): string {
    return btoa(String.fromCharCode(...salt));
  }

  // Convert base64 to salt
  static base64ToSalt(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }
}

// Key management for user sessions
export class KeyManager {
  private static readonly STORAGE_KEY = 'e2e_encryption_key';
  private static readonly SALT_KEY = 'e2e_salt';
  private static currentKey: CryptoKey | null = null;

  // Initialize encryption key from user password
  static async initializeFromPassword(password: string): Promise<void> {
    let salt = this.getSalt();
    if (!salt) {
      salt = E2EEncryption.generateSalt();
      this.storeSalt(salt);
    }

    this.currentKey = await E2EEncryption.deriveKeyFromPassword(password, salt);
    
    // Store key in session storage (not persisted across browser sessions)
    const keyData = await E2EEncryption.exportKey(this.currentKey);
    sessionStorage.setItem(this.STORAGE_KEY, keyData);
  }

  // Get current encryption key
  static async getCurrentKey(): Promise<CryptoKey | null> {
    if (this.currentKey) {
      return this.currentKey;
    }

    const keyData = sessionStorage.getItem(this.STORAGE_KEY);
    if (keyData) {
      this.currentKey = await E2EEncryption.importKey(keyData);
      return this.currentKey;
    }

    return null;
  }

  // Clear encryption key (on logout)
  static clearKey(): void {
    this.currentKey = null;
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  // Store salt in localStorage (persisted)
  private static storeSalt(salt: Uint8Array): void {
    localStorage.setItem(this.SALT_KEY, E2EEncryption.saltToBase64(salt));
  }

  // Get salt from localStorage
  private static getSalt(): Uint8Array | null {
    const saltB64 = localStorage.getItem(this.SALT_KEY);
    return saltB64 ? E2EEncryption.base64ToSalt(saltB64) : null;
  }

  // Encrypt data if key is available
  static async encryptIfAvailable(text: string): Promise<string> {
    const key = await this.getCurrentKey();
    if (key) {
      return await E2EEncryption.encryptText(text, key);
    }
    return text; // Fallback to unencrypted if no key
  }

  // Decrypt data if key is available
  static async decryptIfAvailable(encryptedText: string): Promise<string> {
    const key = await this.getCurrentKey();
    if (key) {
      try {
        return await E2EEncryption.decryptText(encryptedText, key);
      } catch (error) {
        console.warn('Failed to decrypt data, returning original:', error);
        return encryptedText; // Fallback to original if decryption fails
      }
    }
    return encryptedText; // Fallback to original if no key
  }
}