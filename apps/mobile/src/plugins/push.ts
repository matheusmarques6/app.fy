import { getTenantConfig } from '@mobile/config/app.config';
import { getAuthHeaders } from '@mobile/utils/auth';
import { getDeviceInfo } from '@mobile/utils/device';
import { trackEvent } from '@mobile/events/tracker';

/**
 * Push notification plugin.
 *
 * CRITICAL: The app NEVER sends push notifications directly.
 * It only registers the device token and sends it to the backend.
 * Flow: app -> backend API -> OneSignal -> device
 */

let isInitialized = false;

/**
 * Initialize OneSignal with the tenant's app ID.
 * Registers the device token with the backend.
 */
export async function initializePush(): Promise<void> {
  if (isInitialized) return;

  const config = getTenantConfig();

  // OneSignal initialization would happen here via onesignal-cordova-plugin
  // OneSignal.initialize(config.onesignalAppId);
  // OneSignal.Notifications.requestPermission(true);

  // Register device token callback
  // OneSignal.User.pushSubscription.addEventListener('change', async (event) => {
  //   const token = event.current.token;
  //   if (token) await registerDeviceToken(token);
  // });

  isInitialized = true;

  // Placeholder: in production, the token comes from OneSignal callback
  // For now, log that push was initialized
  void config.onesignalAppId;
}

/**
 * Register device token with the backend API.
 * The backend stores the token and uses it to send pushes via OneSignal.
 */
export async function registerDeviceToken(deviceToken: string): Promise<void> {
  const config = getTenantConfig();
  const deviceInfo = await getDeviceInfo();

  const url = `${config.apiBaseUrl}/devices`;

  try {
    const headers = await getAuthHeaders(config.tenantId);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deviceToken,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        appVersion: deviceInfo.appVersion,
      }),
    });

    if (!response.ok) {
      // Device registration failed — will retry on next app open
    }
  } catch {
    // Network error — will retry on next app open
  }
}

/**
 * Handle push notification opened event.
 * Extracts notification ID and tracks the event.
 */
export async function handlePushOpened(notificationId: string): Promise<void> {
  await trackEvent('push_opened', {
    notificationId,
    ref: `push_${notificationId}`,
  });
}
