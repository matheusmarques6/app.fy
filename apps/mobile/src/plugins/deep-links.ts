import { trackEvent } from '@mobile/events/tracker';

/**
 * Deep link handler for push notification tracking.
 * Parses URLs with ?ref=push_{id} to track push interactions.
 */

const PUSH_REF_PATTERN = /[?&]ref=push_([a-zA-Z0-9-]+)/;

/**
 * Parse a deep link URL and extract the push notification reference.
 * Returns the notification ID if found, null otherwise.
 */
export function extractPushRef(url: string): string | null {
  const match = PUSH_REF_PATTERN.exec(url);
  return match?.[1] ?? null;
}

/**
 * Handle an incoming deep link URL.
 * If it contains a push reference, tracks the push_clicked event.
 */
export async function handleDeepLink(url: string): Promise<void> {
  const notificationId = extractPushRef(url);

  if (notificationId) {
    await trackEvent('push_clicked', {
      notificationId,
      ref: `push_${notificationId}`,
      url,
    });
  }
}

/**
 * Register the deep link listener with Capacitor App plugin.
 * Should be called once during app initialization.
 */
export function registerDeepLinkListener(): void {
  // In production, this would use @capacitor/app:
  // import { App } from '@capacitor/app';
  // App.addListener('appUrlOpen', (event) => {
  //   void handleDeepLink(event.url);
  // });
}
