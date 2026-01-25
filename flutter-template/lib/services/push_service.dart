import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import '../config/app_config.dart';
import 'api_service.dart';

/// Push Notification Service using OneSignal
class PushService {
  final ApiService _apiService;

  String? _playerId;
  bool _initialized = false;

  PushService(this._apiService);

  /// Get OneSignal player ID
  String? get playerId => _playerId;

  /// Initialize OneSignal
  Future<void> initialize() async {
    if (_initialized || !AppConfig.isPushEnabled) {
      return;
    }

    try {
      // Initialize OneSignal
      OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
      OneSignal.initialize(AppConfig.oneSignalAppId);

      // Request permission
      await OneSignal.Notifications.requestPermission(true);

      // Get player ID
      _playerId = OneSignal.User.pushSubscription.id;

      // Set external user ID (store_id + device_id)
      final deviceId = await _getDeviceId();
      OneSignal.login('${AppConfig.storeId}:$deviceId');

      // Set tags for segmentation
      OneSignal.User.addTags({
        'store_id': AppConfig.storeId,
        'app_id': AppConfig.appId,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });

      // Listen for notification events
      OneSignal.Notifications.addClickListener(_onNotificationClicked);
      OneSignal.Notifications.addForegroundWillDisplayListener(_onNotificationReceived);

      // Register device with AppFy
      if (_playerId != null) {
        await _registerDevice();
      }

      _initialized = true;
      debugPrint('PushService: Initialized with playerId: $_playerId');
    } catch (e) {
      debugPrint('PushService: Initialization failed: $e');
    }
  }

  /// Register device with AppFy backend
  Future<void> _registerDevice() async {
    if (_playerId == null) return;

    try {
      final response = await _apiService.registerDevice(
        oneSignalPlayerId: _playerId!,
        platform: Platform.isIOS ? 'ios' : 'android',
        deviceInfo: {
          'os_version': Platform.operatingSystemVersion,
          'app_version': AppConfig.versionName,
          'build_number': AppConfig.versionCode,
        },
      );

      // Store device token for API authentication
      final deviceToken = response['device_token'] as String?;
      if (deviceToken != null) {
        _apiService.setDeviceToken(deviceToken);
      }

      debugPrint('PushService: Device registered successfully');
    } catch (e) {
      debugPrint('PushService: Device registration failed: $e');
    }
  }

  /// Handle notification click
  void _onNotificationClicked(OSNotificationClickEvent event) {
    debugPrint('PushService: Notification clicked: ${event.notification.title}');

    final data = event.notification.additionalData;
    if (data != null) {
      // Handle deep linking based on notification data
      final action = data['action'] as String?;
      final targetId = data['target_id'] as String?;

      switch (action) {
        case 'open_product':
          if (targetId != null) {
            // Navigate to product page
            // navigationService.navigateTo('/product/$targetId');
          }
          break;
        case 'open_category':
          if (targetId != null) {
            // Navigate to category page
            // navigationService.navigateTo('/category/$targetId');
          }
          break;
        case 'open_cart':
          // Navigate to cart
          // navigationService.navigateTo('/cart');
          break;
        case 'open_url':
          final url = data['url'] as String?;
          if (url != null) {
            // Open URL in browser or webview
          }
          break;
      }
    }

    // Track notification click
    _apiService.trackEvent(
      eventType: 'notification_clicked',
      properties: {
        'notification_id': event.notification.notificationId,
        'title': event.notification.title,
      },
    );
  }

  /// Handle notification received in foreground
  void _onNotificationReceived(OSNotificationWillDisplayEvent event) {
    debugPrint('PushService: Notification received: ${event.notification.title}');

    // Show the notification
    event.notification.display();

    // Track notification received
    _apiService.trackEvent(
      eventType: 'notification_received',
      properties: {
        'notification_id': event.notification.notificationId,
        'title': event.notification.title,
      },
    );
  }

  /// Get a unique device ID
  Future<String> _getDeviceId() async {
    // In production, use device_info_plus to get a stable device ID
    // For now, use a simple approach
    return '${Platform.isIOS ? 'ios' : 'android'}_${DateTime.now().millisecondsSinceEpoch}';
  }

  /// Set user tags for segmentation
  Future<void> setTags(Map<String, String> tags) async {
    OneSignal.User.addTags(tags);
  }

  /// Remove user tags
  Future<void> removeTags(List<String> keys) async {
    OneSignal.User.removeTags(keys);
  }
}
