/**
 * Biometrics plugin — Face ID / Touch ID wrapper.
 * Uses Capacitor native plugin for biometric authentication.
 */

export interface BiometricsResult {
  readonly success: boolean;
  readonly error: string | null;
}

/**
 * Check if biometric authentication is available on the device.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  // Placeholder: In production, use a Capacitor biometrics plugin
  // e.g., @capacitor-community/biometric-auth
  // const result = await BiometricAuth.isAvailable();
  // return result.isAvailable;
  return Promise.resolve(false);
}

/**
 * Prompt the user for biometric authentication.
 * Returns success/failure with optional error message.
 */
export async function authenticateWithBiometrics(
  reason: string = 'Authenticate to continue',
): Promise<BiometricsResult> {
  const available = await isBiometricsAvailable();

  if (!available) {
    return { success: false, error: 'Biometrics not available on this device' };
  }

  // Placeholder: In production, use the biometric auth plugin
  // try {
  //   await BiometricAuth.authenticate({ reason });
  //   return { success: true, error: null };
  // } catch (err) {
  //   return { success: false, error: 'Authentication failed' };
  // }

  void reason;
  return { success: false, error: 'Biometrics not implemented' };
}
