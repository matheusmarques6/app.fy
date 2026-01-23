import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:uuid/uuid.dart';

import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import 'api_client.dart';

/// Auth state
class AuthState {
  final String? deviceId;
  final String? accessToken;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.deviceId,
    this.accessToken,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    String? deviceId,
    String? accessToken,
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      deviceId: deviceId ?? this.deviceId,
      accessToken: accessToken ?? this.accessToken,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Auth provider - handles device bootstrap and token management
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState());

  final _deviceInfo = DeviceInfoPlugin();
  final _uuid = const Uuid();

  /// Bootstrap the device - register or restore existing session
  Future<void> bootstrap() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // Check if we have existing tokens
      final existingToken = await SecureStorage.instance.getAccessToken();
      final existingDeviceId = await SecureStorage.instance.getDeviceId();

      if (existingToken != null && existingDeviceId != null) {
        // Try to use existing tokens
        state = state.copyWith(
          deviceId: existingDeviceId,
          accessToken: existingToken,
          isAuthenticated: true,
          isLoading: false,
        );
        return;
      }

      // Need to register device
      await _registerDevice();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Register device with backend
  Future<void> _registerDevice() async {
    final fingerprint = await _generateFingerprint();
    final platform = Platform.isIOS ? 'ios' : 'android';
    final locale = Platform.localeName;
    final timezone = DateTime.now().timeZoneName;

    // Get OneSignal subscription ID
    String? oneSignalSubId;
    try {
      final pushState = OneSignal.User.pushSubscription;
      oneSignalSubId = pushState.id;
    } catch (e) {
      // OneSignal not initialized yet
    }

    final response = await ApiClient.instance.post(
      '/auth/devices/register',
      data: {
        'app_id': AppConfig.appId,
        'store_id': AppConfig.storeId,
        'device_fingerprint': fingerprint,
        'platform': platform,
        'locale': locale,
        'timezone': timezone,
        'country_guess': _guessCountry(locale),
        'onesignal': {
          'provider_sub_id': oneSignalSubId,
        },
        'attestation': {
          'type': 'none', // TODO: Implement Play Integrity / App Attest
          'token': null,
        },
      },
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = response.data;

      // Save tokens
      await SecureStorage.instance.setDeviceId(data['device_id']);
      await SecureStorage.instance.setAccessToken(data['access_token']);
      await SecureStorage.instance.setRefreshToken(data['refresh_token']);

      // Calculate and save server time offset
      final serverTime = DateTime.parse(data['server_time']);
      final localTime = DateTime.now();
      final offsetMs = serverTime.difference(localTime).inMilliseconds;
      await SecureStorage.instance.setServerTimeOffset(offsetMs);

      // Set external user ID in OneSignal
      try {
        OneSignal.login(data['device_id']);
      } catch (e) {
        // Ignore OneSignal errors
      }

      state = state.copyWith(
        deviceId: data['device_id'],
        accessToken: data['access_token'],
        isAuthenticated: true,
        isLoading: false,
      );
    } else {
      throw Exception('Device registration failed');
    }
  }

  /// Generate device fingerprint hash
  Future<String> _generateFingerprint() async {
    final buffer = StringBuffer();

    if (Platform.isAndroid) {
      final androidInfo = await _deviceInfo.androidInfo;
      buffer.write(androidInfo.model);
      buffer.write(androidInfo.brand);
      buffer.write(androidInfo.device);
      buffer.write(androidInfo.version.sdkInt);
    } else if (Platform.isIOS) {
      final iosInfo = await _deviceInfo.iosInfo;
      buffer.write(iosInfo.model);
      buffer.write(iosInfo.systemVersion);
      buffer.write(iosInfo.identifierForVendor ?? '');
    }

    // Simple hash (in production, use proper hashing)
    return buffer.toString().hashCode.toRadixString(16);
  }

  /// Guess country from locale
  String _guessCountry(String locale) {
    if (locale.contains('_')) {
      return locale.split('_').last.toUpperCase();
    }
    if (locale.contains('-')) {
      return locale.split('-').last.toUpperCase();
    }
    return 'US'; // Default
  }

  /// Update OneSignal subscription ID
  Future<void> updatePushSubscription(String subscriptionId) async {
    final deviceId = state.deviceId;
    if (deviceId == null) return;

    try {
      await ApiClient.instance.put(
        '/devices/$deviceId/push-subscription',
        data: {
          'provider': 'onesignal',
          'provider_sub_id': subscriptionId,
        },
      );
    } catch (e) {
      // Log but don't fail
    }
  }

  /// Set identity hint (from WebView bridge)
  Future<void> setIdentityHint({
    String? externalCustomerId,
    String? emailHash,
  }) async {
    final deviceId = state.deviceId;
    if (deviceId == null) return;

    try {
      await ApiClient.instance.post(
        '/devices/$deviceId/identity-hint',
        data: {
          'external_customer_id': externalCustomerId,
          'email_hash': emailHash,
        },
      );
    } catch (e) {
      // Log but don't fail - identity will be confirmed via webhook
    }
  }

  /// Clear auth state (on revocation)
  Future<void> logout() async {
    await SecureStorage.instance.clearAuth();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  ApiClient.instance.init();
  return AuthNotifier();
});
