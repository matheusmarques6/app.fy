import { loadTenantConfig } from '@mobile/config/app.config';
import { startEventFlushing, trackEvent } from '@mobile/events/tracker';
import { registerDeepLinkListener } from '@mobile/plugins/deep-links';
import { initializePush } from '@mobile/plugins/push';
import { initializeOfflineMode } from '@mobile/plugins/offline';

/**
 * AppFy Mobile — Capacitor WebView wrapper entry point.
 *
 * This is the infrastructure layer that:
 * 1. Loads tenant configuration
 * 2. Registers device for push notifications (server-only pattern)
 * 3. Sets up deep link handling for push tracking
 * 4. Initializes event tracking
 * 5. Manages offline mode detection
 *
 * The app NEVER sends push directly — only registers tokens with the backend.
 * Flow: app -> backend API -> OneSignal -> device
 */

export async function initializeApp(): Promise<void> {
  // 1. Load tenant config (bundled at build time)
  loadTenantConfig();

  // 2. Initialize offline detection
  initializeOfflineMode();

  // 3. Initialize push (registers device token with backend)
  await initializePush();

  // 4. Register deep link listener for push tracking
  registerDeepLinkListener();

  // 5. Start periodic event flushing
  startEventFlushing();

  // 6. Track app opened
  await trackEvent('app_opened');
}

// Auto-initialize when module loads
void initializeApp();
