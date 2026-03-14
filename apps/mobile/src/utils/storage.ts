/**
 * Local storage wrapper using Capacitor Preferences plugin.
 * Provides a consistent async API for key-value storage.
 */

// In production, use @capacitor/preferences:
// import { Preferences } from '@capacitor/preferences';

/**
 * Get a value from local storage.
 * Returns null if the key does not exist.
 */
export async function getFromStorage(key: string): Promise<string | null> {
  // return (await Preferences.get({ key })).value;

  // Fallback to localStorage for web/dev
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

/**
 * Set a value in local storage.
 */
export async function setToStorage(key: string, value: string): Promise<void> {
  // await Preferences.set({ key, value });

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

/**
 * Remove a value from local storage.
 */
export async function removeFromStorage(key: string): Promise<void> {
  // await Preferences.remove({ key });

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

/**
 * Clear all values from local storage.
 */
export async function clearStorage(): Promise<void> {
  // await Preferences.clear();

  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
}
