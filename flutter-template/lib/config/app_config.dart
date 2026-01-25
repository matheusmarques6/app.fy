/// App configuration injected at build time via --dart-define
/// These values are set by Codemagic during the build process
class AppConfig {
  AppConfig._();

  /// AppFy App ID
  static const String appId = String.fromEnvironment(
    'APPFY_APP_ID',
    defaultValue: '',
  );

  /// AppFy Store ID
  static const String storeId = String.fromEnvironment(
    'APPFY_STORE_ID',
    defaultValue: '',
  );

  /// App display name
  static const String appName = String.fromEnvironment(
    'APP_NAME',
    defaultValue: 'Store',
  );

  /// Bundle ID (package name)
  static const String bundleId = String.fromEnvironment(
    'BUNDLE_ID',
    defaultValue: 'com.appfy.store',
  );

  /// Version name (e.g., "1.0.0")
  static const String versionName = String.fromEnvironment(
    'VERSION_NAME',
    defaultValue: '1.0.0',
  );

  /// Version code (build number)
  static const int versionCode = int.fromEnvironment(
    'VERSION_CODE',
    defaultValue: 1,
  );

  /// AppFy API base URL
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.appfy.com/v1',
  );

  /// Store's primary domain (for API requests)
  static const String primaryDomain = String.fromEnvironment(
    'PRIMARY_DOMAIN',
    defaultValue: '',
  );

  /// OneSignal App ID for push notifications
  static const String oneSignalAppId = String.fromEnvironment(
    'ONESIGNAL_APP_ID',
    defaultValue: '',
  );

  /// Remote Config public key (Ed25519) for signature verification
  static const String rcPublicKey = String.fromEnvironment(
    'RC_PUBLIC_KEY',
    defaultValue: '',
  );

  /// Whether the app is properly configured
  static bool get isConfigured =>
      appId.isNotEmpty && storeId.isNotEmpty && primaryDomain.isNotEmpty;

  /// Whether push notifications are enabled
  static bool get isPushEnabled => oneSignalAppId.isNotEmpty;

  /// Whether remote config signature verification is enabled
  static bool get isRemoteConfigSecure => rcPublicKey.isNotEmpty;
}
