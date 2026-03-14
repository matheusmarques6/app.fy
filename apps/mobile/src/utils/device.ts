import { getFromStorage, setToStorage } from './storage';

/**
 * Device information collector.
 *
 * ALLOWED data: device_token, user_id, platform, os_version, app_version
 * NEVER collect: precise location, contacts, phone data
 */

export interface DeviceInfo {
  readonly deviceId: string;
  readonly platform: 'ios' | 'android';
  readonly osVersion: string;
  readonly appVersion: string;
}

const DEVICE_ID_KEY = 'appfy_device_id';

/**
 * Get or generate a persistent device identifier.
 * Uses Capacitor Preferences for persistence across app restarts.
 */
export async function getDeviceId(): Promise<string> {
  const stored = await getFromStorage(DEVICE_ID_KEY);
  if (stored) return stored;

  const id = generateDeviceId();
  await setToStorage(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Get device information for registration with the backend.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = await getDeviceId();

  // TODO: In production, replace with @capacitor/device:
  // const info = await Device.getInfo();
  // return { deviceId, platform: info.platform, osVersion: info.osVersion, appVersion: info.appBuild };

  return {
    deviceId,
    platform: detectPlatform(),
    osVersion: 'unknown',
    appVersion: '0.0.1',
  };
}

function generateDeviceId(): string {
  return crypto.randomUUID();
}

function detectPlatform(): 'ios' | 'android' {
  // Placeholder: in production, use @capacitor/device Device.getInfo()
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  }
  return 'android';
}
