/**
 * Offline mode plugin — connectivity detection and cache strategy.
 */

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

let currentStatus: ConnectivityStatus = 'unknown';
const listeners: Array<(status: ConnectivityStatus) => void> = [];

/**
 * Get the current connectivity status.
 */
export function getConnectivityStatus(): ConnectivityStatus {
  return currentStatus;
}

/**
 * Check if the app is currently online.
 */
export function isOnline(): boolean {
  return currentStatus === 'online';
}

/**
 * Register a listener for connectivity changes.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(
  listener: (status: ConnectivityStatus) => void,
): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Initialize connectivity monitoring.
 * Should be called once during app initialization.
 */
export function initializeOfflineMode(): void {
  // In production, use @capacitor/network:
  // import { Network } from '@capacitor/network';
  // const status = await Network.getStatus();
  // currentStatus = status.connected ? 'online' : 'offline';
  //
  // Network.addListener('networkStatusChange', (status) => {
  //   currentStatus = status.connected ? 'online' : 'offline';
  //   listeners.forEach((l) => l(currentStatus));
  // });

  // Default to online for now
  currentStatus = 'online';
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(currentStatus);
  }
}

/**
 * Update connectivity status (for testing or manual override).
 */
export function setConnectivityStatus(status: ConnectivityStatus): void {
  currentStatus = status;
  notifyListeners();
}
