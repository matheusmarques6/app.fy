/// Static app configuration
/// These values are embedded at build time and identify the app/store
class AppConfig {
  AppConfig._();

  // These will be replaced at build time for each store's app
  static const String appId = String.fromEnvironment(
    'APP_ID',
    defaultValue: 'dev-app-id',
  );

  static const String storeId = String.fromEnvironment(
    'STORE_ID',
    defaultValue: 'dev-store-id',
  );

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/v1',
  );

  static const String primaryDomain = String.fromEnvironment(
    'PRIMARY_DOMAIN',
    defaultValue: 'https://example.com',
  );

  static const String oneSignalAppId = String.fromEnvironment(
    'ONESIGNAL_APP_ID',
    defaultValue: '',
  );

  // Remote Config public key for signature validation (Ed25519)
  static const String remoteConfigPublicKey = String.fromEnvironment(
    'RC_PUBLIC_KEY',
    defaultValue: '',
  );

  // App version info
  static const String appVersion = '1.0.0';
  static const int appBuildNumber = 1;
}
