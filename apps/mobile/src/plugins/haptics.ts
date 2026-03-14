/**
 * Haptics plugin — haptic feedback wrapper for UI interactions.
 * Uses @capacitor/haptics under the hood.
 */

// In production, import from @capacitor/haptics:
// import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type ImpactStyle = 'heavy' | 'medium' | 'light';
export type NotificationType = 'success' | 'warning' | 'error';

/**
 * Trigger impact haptic feedback (for button taps, selections).
 */
export async function impact(style: ImpactStyle = 'light'): Promise<void> {
  // Haptics.impact({ style: ImpactStyle[style] });
  void style;
  return Promise.resolve();
}

/**
 * Trigger notification haptic feedback (for success/warning/error).
 */
export async function notification(type: NotificationType = 'success'): Promise<void> {
  // Haptics.notification({ type: NotificationType[type] });
  void type;
  return Promise.resolve();
}

/**
 * Trigger selection haptic feedback (for picker/scroll selections).
 */
export async function selectionChanged(): Promise<void> {
  // Haptics.selectionChanged();
  return Promise.resolve();
}

/**
 * Start a continuous vibration (for long-press actions).
 */
export async function vibrate(duration: number = 300): Promise<void> {
  // Haptics.vibrate({ duration });
  void duration;
  return Promise.resolve();
}
