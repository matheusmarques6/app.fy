import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../api/auth_provider.dart';
import '../storage/secure_storage.dart';
import 'event_tracker.dart';

/// WebView Bridge - handles messages from JavaScript
class WebViewBridge {
  final WidgetRef _ref;
  final _logger = Logger();

  // Allowed internal routes (regex patterns)
  static final _allowedRoutes = [
    RegExp(r'^/$'),
    RegExp(r'^/products/[\w-]+$'),
    RegExp(r'^/collections/[\w-]+$'),
    RegExp(r'^/cart$'),
    RegExp(r'^/checkout$'),
    RegExp(r'^/account$'),
    RegExp(r'^/orders$'),
    RegExp(r'^/orders/[\w-]+$'),
    RegExp(r'^/search$'),
    RegExp(r'^/pages/[\w-]+$'),
  ];

  WebViewBridge(this._ref);

  /// Handle message from JavaScript bridge
  Future<void> handleMessage(String message, WebViewController controller) async {
    try {
      final data = jsonDecode(message) as Map<String, dynamic>;
      final type = data['type'] as String;
      final payload = data['data'] as Map<String, dynamic>?;

      switch (type) {
        case 'trackEvent':
          await _handleTrackEvent(payload);
          break;
        case 'requestNavigation':
          await _handleRequestNavigation(payload, controller);
          break;
        case 'setIdentityHint':
          await _handleSetIdentityHint(payload);
          break;
        case 'getDeviceInfo':
          await _handleGetDeviceInfo(controller);
          break;
        default:
          _logger.w('Unknown bridge message type: $type');
      }
    } catch (e, st) {
      _logger.e('Bridge message error', error: e, stackTrace: st);
    }
  }

  /// Handle trackEvent call
  Future<void> _handleTrackEvent(Map<String, dynamic>? payload) async {
    if (payload == null) return;

    final name = payload['name'] as String?;
    final props = payload['props'] as Map<String, dynamic>?;

    if (name == null || name.isEmpty) {
      _logger.w('trackEvent called without name');
      return;
    }

    // Validate event name (allowed list)
    if (!_isAllowedEventName(name)) {
      _logger.w('trackEvent called with disallowed name: $name');
      return;
    }

    // Validate props size (max 16KB)
    final propsJson = jsonEncode(props ?? {});
    if (propsJson.length > 16384) {
      _logger.w('trackEvent props too large: ${propsJson.length} bytes');
      return;
    }

    // Queue event for sending
    await EventTracker.instance.trackEvent(name, props ?? {});
  }

  /// Handle requestNavigation call - CRITICAL SECURITY
  Future<void> _handleRequestNavigation(
      Map<String, dynamic>? payload, WebViewController controller) async {
    if (payload == null) return;

    final route = payload['route'] as String?;
    if (route == null || route.isEmpty) {
      _logger.w('requestNavigation called without route');
      return;
    }

    // SECURITY: Canonicalize and validate route
    final sanitizedRoute = _sanitizeRoute(route);
    if (sanitizedRoute == null) {
      _logger.w('requestNavigation blocked: invalid route $route');
      return;
    }

    // Check against allowlist
    if (!_isAllowedRoute(sanitizedRoute)) {
      _logger.w('requestNavigation blocked: disallowed route $sanitizedRoute');
      return;
    }

    // Navigate within WebView
    // Note: This appends the route to the primary domain
    final deviceId = await SecureStorage.instance.getDeviceId();
    final baseUrl = _ref.read(remoteConfigProvider).valueOrNull?.primaryDomains.first ?? '';

    if (baseUrl.isNotEmpty) {
      final targetUrl = Uri.parse(baseUrl).replace(path: sanitizedRoute);
      await controller.loadRequest(targetUrl);
    }
  }

  /// Sanitize and validate route - CRITICAL SECURITY
  String? _sanitizeRoute(String route) {
    // Must start with /
    if (!route.startsWith('/')) {
      return null;
    }

    // Decode URL encoding
    String decoded;
    try {
      decoded = Uri.decodeComponent(route);
    } catch (e) {
      return null;
    }

    // Block path traversal
    if (decoded.contains('..') ||
        decoded.contains('%2e') ||
        decoded.contains('%2E')) {
      return null;
    }

    // Block double slashes
    if (decoded.contains('//')) {
      return null;
    }

    // Block dangerous characters
    if (decoded.contains('<') ||
        decoded.contains('>') ||
        decoded.contains('"') ||
        decoded.contains("'")) {
      return null;
    }

    // Block schemes
    if (decoded.contains(':')) {
      return null;
    }

    // Normalize: lowercase, trim
    return decoded.toLowerCase().trim();
  }

  /// Check if route is in allowlist
  bool _isAllowedRoute(String route) {
    for (final pattern in _allowedRoutes) {
      if (pattern.hasMatch(route)) {
        return true;
      }
    }
    return false;
  }

  /// Handle setIdentityHint call
  Future<void> _handleSetIdentityHint(Map<String, dynamic>? payload) async {
    if (payload == null) return;

    final customerId = payload['customer_id'] as String?;
    final emailHash = payload['email_hash'] as String?;

    // This is just a HINT - identity is confirmed via webhook
    await _ref.read(authProvider.notifier).setIdentityHint(
      externalCustomerId: customerId,
      emailHash: emailHash,
    );
  }

  /// Handle getDeviceInfo request
  Future<void> _handleGetDeviceInfo(WebViewController controller) async {
    final deviceId = await SecureStorage.instance.getDeviceId();

    final deviceInfo = {
      'device_id': deviceId,
      'platform': 'mobile',
    };

    final script = '''
      if (window._appfyDeviceCallback) {
        window._appfyDeviceCallback(${jsonEncode(deviceInfo)});
        window._appfyDeviceCallback = null;
      }
    ''';

    await controller.runJavaScript(script);
  }

  /// Check if event name is allowed
  bool _isAllowedEventName(String name) {
    const allowedEvents = {
      'page_view',
      'view_product',
      'view_collection',
      'search',
      'add_to_cart',
      'remove_from_cart',
      'begin_checkout',
      'add_payment_info',
      'purchase_detected',
      'purchase_confirmed',
      'login',
      'signup',
      'push_delivered',
      'push_opened',
      'push_clicked',
      'app_open',
      'app_background',
    };
    return allowedEvents.contains(name);
  }
}

// Import for remote config access
import '../config/remote_config_provider.dart';
