import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import '../api/api_client.dart';
import '../bridge/event_tracker.dart';
import '../storage/event_queue_db.dart';
import '../storage/secure_storage.dart';

/// Push notification service using OneSignal
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final _logger = Logger();
  BuildContext? _context;

  /// Initialize push service
  Future<void> init(String oneSignalAppId) async {
    if (oneSignalAppId.isEmpty) {
      _logger.w('OneSignal app ID is empty, skipping initialization');
      return;
    }

    // Initialize OneSignal
    OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
    OneSignal.initialize(oneSignalAppId);

    // Request permission
    OneSignal.Notifications.requestPermission(true);

    // Listen for subscription changes
    OneSignal.User.pushSubscription.addObserver((state) {
      _handleSubscriptionChange(state.current);
    });

    // Listen for notification received (foreground)
    OneSignal.Notifications.addForegroundWillDisplayListener((event) {
      _handleNotificationReceived(event.notification);
      // Show the notification
      event.notification.display();
    });

    // Listen for notification clicked
    OneSignal.Notifications.addClickListener((event) {
      _handleNotificationClicked(event.notification);
    });
  }

  /// Set context for navigation
  void setContext(BuildContext context) {
    _context = context;
  }

  /// Handle subscription state changes
  Future<void> _handleSubscriptionChange(OSPushSubscriptionState state) async {
    final subscriptionId = state.id;
    if (subscriptionId == null) return;

    final deviceId = await SecureStorage.instance.getDeviceId();
    if (deviceId == null) return;

    // Update backend with new subscription
    try {
      await ApiClient.instance.put(
        '/devices/$deviceId/push-subscription',
        data: {
          'provider': 'onesignal',
          'provider_sub_id': subscriptionId,
          'opted_in': state.optedIn,
        },
      );
    } catch (e) {
      _logger.e('Failed to update push subscription', error: e);
    }

    // Set external user ID for targeting
    OneSignal.login(deviceId);
  }

  /// Handle notification received (foreground)
  Future<void> _handleNotificationReceived(OSNotification notification) async {
    // Save to local inbox
    await _saveToInbox(notification);

    // Track delivery event
    await _trackDeliveryEvent(notification);
  }

  /// Handle notification clicked
  Future<void> _handleNotificationClicked(OSNotification notification) async {
    // Mark as read in inbox
    final messageId = notification.notificationId;
    if (messageId != null) {
      await EventQueueDb.instance.markPushRead(messageId);
    }

    // Track click event
    await _trackClickEvent(notification);

    // Handle deep link
    final data = notification.additionalData;
    if (data != null) {
      await _handleDeepLink(data);
    }
  }

  /// Save notification to local inbox
  Future<void> _saveToInbox(OSNotification notification) async {
    final messageId = notification.notificationId ?? DateTime.now().toIso8601String();
    final title = notification.title ?? '';
    final body = notification.body ?? '';
    final data = notification.additionalData;

    await EventQueueDb.instance.addPushMessage(
      messageId,
      title,
      body,
      data,
    );
  }

  /// Track push delivery event
  Future<void> _trackDeliveryEvent(OSNotification notification) async {
    final data = notification.additionalData;
    final campaignId = data?['campaign_id'] as String?;
    final deliveryId = data?['delivery_id'] as String?;

    await EventTracker.instance.trackEvent('push_delivered', {
      'notification_id': notification.notificationId,
      'campaign_id': campaignId,
      'delivery_id': deliveryId,
    });
  }

  /// Track push click event
  Future<void> _trackClickEvent(OSNotification notification) async {
    final data = notification.additionalData;
    final campaignId = data?['campaign_id'] as String?;
    final deliveryId = data?['delivery_id'] as String?;

    await EventTracker.instance.trackEvent('push_clicked', {
      'notification_id': notification.notificationId,
      'campaign_id': campaignId,
      'delivery_id': deliveryId,
    });
  }

  /// Handle deep link from notification
  Future<void> _handleDeepLink(Map<String, dynamic> data) async {
    final route = data['route'] as String?;
    final url = data['url'] as String?;

    if (route != null && _context != null) {
      // Navigate to internal route
      _context!.go(route);
    } else if (url != null) {
      // Handle external URL or web route
      // This will be handled by the WebView
      if (_context != null) {
        _context!.go('/?url=${Uri.encodeComponent(url)}');
      }
    }
  }

  /// Request notification permission
  Future<bool> requestPermission() async {
    return await OneSignal.Notifications.requestPermission(true);
  }

  /// Check if notifications are enabled
  bool get areNotificationsEnabled {
    return OneSignal.Notifications.permission;
  }

  /// Get current subscription ID
  String? get subscriptionId {
    return OneSignal.User.pushSubscription.id;
  }

  /// Opt out of notifications
  Future<void> optOut() async {
    OneSignal.User.pushSubscription.optOut();
  }

  /// Opt in to notifications
  Future<void> optIn() async {
    OneSignal.User.pushSubscription.optIn();
  }
}
