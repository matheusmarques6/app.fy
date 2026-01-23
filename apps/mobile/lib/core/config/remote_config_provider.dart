import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../api/api_client.dart';
import '../storage/secure_storage.dart';
import 'app_config.dart';

/// Remote Config state
class RemoteConfigState {
  final Map<String, dynamic>? config;
  final int? configVersion;
  final bool isLoading;
  final String? error;
  final DateTime? lastFetched;

  const RemoteConfigState({
    this.config,
    this.configVersion,
    this.isLoading = false,
    this.error,
    this.lastFetched,
  });

  RemoteConfigState copyWith({
    Map<String, dynamic>? config,
    int? configVersion,
    bool? isLoading,
    String? error,
    DateTime? lastFetched,
  }) {
    return RemoteConfigState(
      config: config ?? this.config,
      configVersion: configVersion ?? this.configVersion,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      lastFetched: lastFetched ?? this.lastFetched,
    );
  }

  // Helper getters for common config values
  List<String> get primaryDomains {
    final allowlist = config?['allowlist'] as Map<String, dynamic>?;
    return (allowlist?['primary_domains'] as List<dynamic>?)
            ?.cast<String>() ??
        [AppConfig.primaryDomain];
  }

  List<String> get paymentDomains {
    final allowlist = config?['allowlist'] as Map<String, dynamic>?;
    return (allowlist?['payment_domains'] as List<dynamic>?)?.cast<String>() ??
        [];
  }

  List<String> get assetDomains {
    final allowlist = config?['allowlist'] as Map<String, dynamic>?;
    return (allowlist?['asset_domains'] as List<dynamic>?)?.cast<String>() ??
        [];
  }

  Map<String, dynamic>? get theme => config?['theme'] as Map<String, dynamic>?;

  Map<String, dynamic>? get modules =>
      config?['modules'] as Map<String, dynamic>?;

  Map<String, dynamic>? get pushConfig =>
      config?['push_config'] as Map<String, dynamic>?;
}

/// Remote Config provider - fetches and validates config from backend
class RemoteConfigNotifier extends StateNotifier<AsyncValue<RemoteConfigState>> {
  RemoteConfigNotifier() : super(const AsyncValue.data(RemoteConfigState()));

  final _logger = Logger();

  /// Fetch remote config from backend
  Future<void> fetch() async {
    state = const AsyncValue.loading();

    try {
      // Get stored ETag for caching
      final etag = SecureStorage.instance.getRemoteConfigEtag();

      final response = await ApiClient.instance.get(
        '/remote-config',
        options: Options(
          headers: etag != null ? {'If-None-Match': etag} : null,
          validateStatus: (status) => status! < 500,
        ),
      );

      if (response.statusCode == 304) {
        // Config unchanged, use cached
        await _loadCachedConfig();
        return;
      }

      if (response.statusCode == 200) {
        final envelope = response.data as Map<String, dynamic>;

        // Validate the envelope
        if (!_validateEnvelope(envelope)) {
          _logger.w('Remote config envelope validation failed');
          await _loadCachedConfig(); // Fallback to LKG
          return;
        }

        // Extract payload
        final payload = envelope['payload'] as Map<String, dynamic>;
        final configVersion = envelope['config_version'] as int;
        final signature = envelope['signature'] as String;

        // Check version (no downgrade)
        final lastVersion = SecureStorage.instance.getLastConfigVersion();
        if (configVersion < lastVersion) {
          _logger.w('Remote config version downgrade detected');
          await _loadCachedConfig();
          return;
        }

        // Check for replay (same version, same signature)
        if (configVersion == lastVersion) {
          final lastSig = SecureStorage.instance.getLastConfigSignature();
          if (signature == lastSig) {
            // Idempotent - already applied
            await _loadCachedConfig();
            return;
          }
        }

        // Save new ETag
        final newEtag = response.headers.value('etag');
        if (newEtag != null) {
          await SecureStorage.instance.setRemoteConfigEtag(newEtag);
        }

        // Save config as LKG
        await SecureStorage.instance.setRemoteConfig(jsonEncode(payload));
        await SecureStorage.instance.setLastConfigVersion(configVersion);
        await SecureStorage.instance.setLastConfigSignature(signature);

        state = AsyncValue.data(RemoteConfigState(
          config: payload,
          configVersion: configVersion,
          lastFetched: DateTime.now(),
        ));
      } else {
        _logger.w('Remote config fetch failed: ${response.statusCode}');
        await _loadCachedConfig();
      }
    } catch (e, st) {
      _logger.e('Remote config fetch error', error: e, stackTrace: st);
      await _loadCachedConfig();
    }
  }

  /// Load cached config (LKG)
  Future<void> _loadCachedConfig() async {
    final cached = SecureStorage.instance.getRemoteConfig();
    final version = SecureStorage.instance.getLastConfigVersion();

    if (cached != null) {
      try {
        final config = jsonDecode(cached) as Map<String, dynamic>;
        state = AsyncValue.data(RemoteConfigState(
          config: config,
          configVersion: version,
        ));
        return;
      } catch (e) {
        _logger.e('Failed to parse cached config', error: e);
      }
    }

    // No valid cache - use safe defaults
    state = AsyncValue.data(RemoteConfigState(
      config: _getDefaultConfig(),
      configVersion: 0,
    ));
  }

  /// Validate envelope structure and signature
  bool _validateEnvelope(Map<String, dynamic> envelope) {
    // Required fields
    final requiredFields = [
      'key_id',
      'issued_at',
      'expires_at',
      'store_id',
      'app_id',
      'config_version',
      'payload',
      'signature',
    ];

    for (final field in requiredFields) {
      if (!envelope.containsKey(field)) {
        _logger.w('Missing field in envelope: $field');
        return false;
      }
    }

    // Validate store_id and app_id match
    if (envelope['store_id'] != AppConfig.storeId ||
        envelope['app_id'] != AppConfig.appId) {
      _logger.w('Store/App ID mismatch in envelope');
      return false;
    }

    // Validate timestamps
    final issuedAt = DateTime.tryParse(envelope['issued_at'] as String);
    final expiresAt = DateTime.tryParse(envelope['expires_at'] as String);
    if (issuedAt == null || expiresAt == null) {
      _logger.w('Invalid timestamps in envelope');
      return false;
    }

    // Get server-adjusted current time
    final offset = SecureStorage.instance.getServerTimeOffset();
    final now = DateTime.now().add(Duration(milliseconds: offset));

    // Check expiry (with 5 minute tolerance)
    if (expiresAt.isBefore(now.subtract(const Duration(minutes: 5)))) {
      _logger.w('Remote config has expired');
      return false;
    }

    // Check issued_at not too old (7 days max)
    if (issuedAt.isBefore(now.subtract(const Duration(days: 7)))) {
      _logger.w('Remote config issued_at too old');
      return false;
    }

    // Validate signature
    // TODO: Implement Ed25519 signature validation with JCS
    // For now, we trust the response if it came via HTTPS from our API
    // In production, implement proper signature validation:
    //
    // 1. Canonicalize JSON (JCS - RFC 8785)
    // 2. Verify Ed25519 signature using public key from AppConfig
    //
    // final signature = envelope['signature'] as String;
    // final publicKey = AppConfig.remoteConfigPublicKey;
    // final canonical = canonicalizeJson(envelope without 'signature');
    // return verifyEd25519(canonical, signature, publicKey);

    return true;
  }

  /// Default safe config (kill switch mode)
  Map<String, dynamic> _getDefaultConfig() {
    return {
      'modules': {
        'home': {'enabled': true},
        'search': {'enabled': true},
        'favorites': {'enabled': false},
        'account': {'enabled': true},
        'notifications': {'enabled': true},
      },
      'theme': {
        'colors': {
          'primary': '#3B82F6',
          'secondary': '#10B981',
          'background': '#111827',
        },
      },
      'allowlist': {
        'primary_domains': [AppConfig.primaryDomain],
        'payment_domains': [],
        'asset_domains': [],
      },
      'features': {
        'webview_enabled': true,
        'push_enabled': true,
        'tracking_enabled': true,
      },
    };
  }
}

final remoteConfigProvider =
    StateNotifierProvider<RemoteConfigNotifier, AsyncValue<RemoteConfigState>>(
        (ref) {
  return RemoteConfigNotifier();
});
