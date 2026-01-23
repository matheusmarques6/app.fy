import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Secure storage for sensitive data (tokens, etc.)
class SecureStorage {
  SecureStorage._();
  static final SecureStorage instance = SecureStorage._();

  late final FlutterSecureStorage _secureStorage;
  late final SharedPreferences _prefs;

  // Keys
  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyDeviceId = 'device_id';
  static const _keyServerTimeOffset = 'server_time_offset';
  static const _keyLastConfigVersion = 'last_config_version';
  static const _keyLastConfigSignature = 'last_config_signature';
  static const _keyRemoteConfig = 'remote_config';
  static const _keyRemoteConfigEtag = 'remote_config_etag';

  Future<void> init() async {
    _secureStorage = const FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
      ),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    );
    _prefs = await SharedPreferences.getInstance();
  }

  // Access Token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _keyAccessToken);
  }

  Future<void> setAccessToken(String token) async {
    await _secureStorage.write(key: _keyAccessToken, value: token);
  }

  Future<void> deleteAccessToken() async {
    await _secureStorage.delete(key: _keyAccessToken);
  }

  // Refresh Token
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _keyRefreshToken);
  }

  Future<void> setRefreshToken(String token) async {
    await _secureStorage.write(key: _keyRefreshToken, value: token);
  }

  Future<void> deleteRefreshToken() async {
    await _secureStorage.delete(key: _keyRefreshToken);
  }

  // Device ID
  Future<String?> getDeviceId() async {
    return await _secureStorage.read(key: _keyDeviceId);
  }

  Future<void> setDeviceId(String deviceId) async {
    await _secureStorage.write(key: _keyDeviceId, value: deviceId);
  }

  // Server Time Offset (for clock skew handling)
  int getServerTimeOffset() {
    return _prefs.getInt(_keyServerTimeOffset) ?? 0;
  }

  Future<void> setServerTimeOffset(int offsetMs) async {
    await _prefs.setInt(_keyServerTimeOffset, offsetMs);
  }

  // Remote Config
  int getLastConfigVersion() {
    return _prefs.getInt(_keyLastConfigVersion) ?? 0;
  }

  Future<void> setLastConfigVersion(int version) async {
    await _prefs.setInt(_keyLastConfigVersion, version);
  }

  String? getLastConfigSignature() {
    return _prefs.getString(_keyLastConfigSignature);
  }

  Future<void> setLastConfigSignature(String signature) async {
    await _prefs.setString(_keyLastConfigSignature, signature);
  }

  String? getRemoteConfig() {
    return _prefs.getString(_keyRemoteConfig);
  }

  Future<void> setRemoteConfig(String config) async {
    await _prefs.setString(_keyRemoteConfig, config);
  }

  String? getRemoteConfigEtag() {
    return _prefs.getString(_keyRemoteConfigEtag);
  }

  Future<void> setRemoteConfigEtag(String etag) async {
    await _prefs.setString(_keyRemoteConfigEtag, etag);
  }

  // Clear all auth data (on logout/revoke)
  Future<void> clearAuth() async {
    await _secureStorage.delete(key: _keyAccessToken);
    await _secureStorage.delete(key: _keyRefreshToken);
    await _secureStorage.delete(key: _keyDeviceId);
  }
}
