import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:logger/logger.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import '../storage/event_queue_db.dart';

/// Event tracker with offline queue
class EventTracker {
  EventTracker._();
  static final EventTracker instance = EventTracker._();

  final _logger = Logger();
  final _uuid = const Uuid();
  final _connectivity = Connectivity();

  Timer? _flushTimer;
  bool _isFlushing = false;

  // Batch configuration
  static const int _batchSize = 50;
  static const Duration _flushInterval = Duration(seconds: 30);

  /// Initialize event tracker
  Future<void> init() async {
    await EventQueueDb.instance.init();

    // Start periodic flush
    _flushTimer = Timer.periodic(_flushInterval, (_) => _flushQueue());

    // Listen for connectivity changes
    _connectivity.onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) {
        _flushQueue();
      }
    });
  }

  /// Track an event (queues locally, sends when online)
  Future<void> trackEvent(String name, Map<String, dynamic> props) async {
    final deviceId = await SecureStorage.instance.getDeviceId();
    if (deviceId == null) {
      _logger.w('Cannot track event: device not registered');
      return;
    }

    final event = QueuedEvent(
      eventId: _uuid.v4(),
      name: name,
      props: props,
      timestamp: DateTime.now().toUtc(),
      deviceId: deviceId,
    );

    // Save to local queue
    await EventQueueDb.instance.enqueue(event);

    // Try immediate flush if online
    final connectivity = await _connectivity.checkConnectivity();
    if (connectivity.any((r) => r != ConnectivityResult.none)) {
      _flushQueue();
    }
  }

  /// Flush queued events to server
  Future<void> _flushQueue() async {
    if (_isFlushing) return;
    _isFlushing = true;

    try {
      final events = await EventQueueDb.instance.getPending(limit: _batchSize);
      if (events.isEmpty) {
        _isFlushing = false;
        return;
      }

      final deviceId = await SecureStorage.instance.getDeviceId();
      if (deviceId == null) {
        _isFlushing = false;
        return;
      }

      // Build batch payload
      final payload = {
        'device_id': deviceId,
        'identity_hint': null, // Will be set if available
        'events': events.map((e) => {
          return {
            'event_id': e.eventId,
            'name': e.name,
            'ts': e.timestamp.toIso8601String(),
            'props': e.props,
          };
        }).toList(),
      };

      final response = await ApiClient.instance.post(
        '/events/ingest',
        data: payload,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        final accepted = (data['accepted'] as List<dynamic>?)?.cast<String>() ?? [];
        final rejected = (data['rejected'] as List<dynamic>?) ?? [];

        // Remove accepted events from queue
        for (final eventId in accepted) {
          await EventQueueDb.instance.remove(eventId);
        }

        // Log rejected events (but still remove them to avoid infinite retry)
        for (final rejection in rejected) {
          final eventId = rejection['event_id'] as String?;
          final reason = rejection['reason'] as String?;
          _logger.w('Event rejected: $eventId - $reason');
          if (eventId != null) {
            await EventQueueDb.instance.remove(eventId);
          }
        }
      }
    } catch (e, st) {
      _logger.e('Event flush failed', error: e, stackTrace: st);
      // Events remain in queue for retry
    } finally {
      _isFlushing = false;
    }
  }

  /// Dispose resources
  void dispose() {
    _flushTimer?.cancel();
  }
}

/// Queued event model
class QueuedEvent {
  final String eventId;
  final String name;
  final Map<String, dynamic> props;
  final DateTime timestamp;
  final String deviceId;
  final int retryCount;

  QueuedEvent({
    required this.eventId,
    required this.name,
    required this.props,
    required this.timestamp,
    required this.deviceId,
    this.retryCount = 0,
  });

  Map<String, dynamic> toJson() => {
    'event_id': eventId,
    'name': name,
    'props': props,
    'timestamp': timestamp.toIso8601String(),
    'device_id': deviceId,
    'retry_count': retryCount,
  };

  factory QueuedEvent.fromJson(Map<String, dynamic> json) => QueuedEvent(
    eventId: json['event_id'] as String,
    name: json['name'] as String,
    props: (json['props'] as Map<String, dynamic>?) ?? {},
    timestamp: DateTime.parse(json['timestamp'] as String),
    deviceId: json['device_id'] as String,
    retryCount: json['retry_count'] as int? ?? 0,
  );
}
