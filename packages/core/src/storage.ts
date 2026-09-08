import type { WytPassStorage } from './types.js';

/**
 * In-memory storage adapter.
 * Safe to use in Node.js, Next.js server, and browser environments.
 */
export class MemoryStorage implements WytPassStorage {
  private cache: Map<string, string> = new Map();

  public get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  public set(key: string, value: string): void {
    this.cache.set(key, value);
  }

  public remove(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

/**
 * Browser Web Storage adapter (wraps localStorage or sessionStorage).
 * Safely degrades if window or storage is inaccessible (e.g. SSR or strict privacy settings).
 */
export class BrowserStorage implements WytPassStorage {
  private storageType: 'sessionStorage' | 'localStorage';
  private fallback: MemoryStorage = new MemoryStorage();

  constructor(storageType: 'sessionStorage' | 'localStorage' = 'sessionStorage') {
    this.storageType = storageType;
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
      const storage = window[this.storageType];
      // Test storage availability (some private windows throw on access)
      const testKey = '__wytpass_test__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  public get(key: string): string | null {
    const storage = this.getStorage();
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        return this.fallback.get(key);
      }
    }
    return this.fallback.get(key);
  }

  public set(key: string, value: string): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        this.fallback.set(key, value);
      }
    } else {
      this.fallback.set(key, value);
    }
  }

  public remove(key: string): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        this.fallback.remove(key);
      }
    }
    this.fallback.remove(key);
  }

  public clear(): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.clear();
      } catch {
        this.fallback.clear();
      }
    }
    this.fallback.clear();
  }
}
