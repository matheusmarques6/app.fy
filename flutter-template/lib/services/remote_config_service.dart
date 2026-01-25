import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import 'api_service.dart';

/// Remote Config Service with Ed25519 signature verification
class RemoteConfigService {
  final ApiService _apiService;

  Map<String, dynamic> _config = {};
  DateTime? _lastFetch;

  static const _cacheDuration = Duration(minutes: 5);

  RemoteConfigService(this._apiService);

  /// Get a config value
  T? getValue<T>(String key, {T? defaultValue}) {
    final value = _config[key];
    if (value is T) return value;
    return defaultValue;
  }

  /// Get string config
  String getString(String key, {String defaultValue = ''}) {
    return getValue<String>(key, defaultValue: defaultValue) ?? defaultValue;
  }

  /// Get bool config
  bool getBool(String key, {bool defaultValue = false}) {
    return getValue<bool>(key, defaultValue: defaultValue) ?? defaultValue;
  }

  /// Get int config
  int getInt(String key, {int defaultValue = 0}) {
    return getValue<int>(key, defaultValue: defaultValue) ?? defaultValue;
  }

  /// Get double config
  double getDouble(String key, {double defaultValue = 0.0}) {
    final value = _config[key];
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? defaultValue;
    return defaultValue;
  }

  /// Fetch and verify remote config from server
  Future<void> fetch({bool force = false}) async {
    // Check cache
    if (!force && _lastFetch != null) {
      final age = DateTime.now().difference(_lastFetch!);
      if (age < _cacheDuration) {
        return;
      }
    }

    try {
      final response = await _apiService.getRemoteConfig();

      final payload = response['payload'] as String?;
      final signature = response['signature'] as String?;

      if (payload == null) {
        debugPrint('RemoteConfig: No payload received');
        return;
      }

      // Verify signature if public key is configured
      if (AppConfig.isRemoteConfigSecure && signature != null) {
        final isValid = await _verifySignature(payload, signature);
        if (!isValid) {
          debugPrint('RemoteConfig: Invalid signature, rejecting config');
          return;
        }
      }

      // Parse and apply config
      final configData = jsonDecode(payload) as Map<String, dynamic>;
      _config = configData;
      _lastFetch = DateTime.now();

      debugPrint('RemoteConfig: Updated with ${_config.length} keys');
    } catch (e) {
      debugPrint('RemoteConfig: Fetch failed: $e');
    }
  }

  /// Verify Ed25519 signature
  Future<bool> _verifySignature(String payload, String signature) async {
    try {
      final publicKeyBytes = base64Decode(AppConfig.rcPublicKey);
      final signatureBytes = base64Decode(signature);
      final payloadBytes = utf8.encode(payload);

      final algorithm = Ed25519();
      final publicKey = SimplePublicKey(
        publicKeyBytes,
        type: KeyPairType.ed25519,
      );

      final isValid = await algorithm.verify(
        payloadBytes,
        signature: Signature(signatureBytes, publicKey: publicKey),
      );

      return isValid;
    } catch (e) {
      debugPrint('RemoteConfig: Signature verification failed: $e');
      return false;
    }
  }

  /// Clear cached config
  void clear() {
    _config = {};
    _lastFetch = null;
  }
}
