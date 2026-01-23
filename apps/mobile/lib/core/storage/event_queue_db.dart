import 'dart:convert';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'dart:io';

import '../bridge/event_tracker.dart';

part 'event_queue_db.g.dart';

/// Events table for offline queue
class Events extends Table {
  TextColumn get eventId => text()();
  TextColumn get name => text()();
  TextColumn get propsJson => text()();
  DateTimeColumn get timestamp => dateTime()();
  TextColumn get deviceId => text()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {eventId};
}

/// Favorites table (for offline access)
class Favorites extends Table {
  TextColumn get productId => text()();
  TextColumn get productJson => text()();
  DateTimeColumn get addedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {productId};
}

/// Push inbox table (for notification center)
class PushInbox extends Table {
  TextColumn get messageId => text()();
  TextColumn get title => text()();
  TextColumn get body => text()();
  TextColumn get dataJson => text().nullable()();
  BoolColumn get isRead => boolean().withDefault(const Constant(false))();
  DateTimeColumn get receivedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {messageId};
}

@DriftDatabase(tables: [Events, Favorites, PushInbox])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 1;
}

/// Event Queue Database singleton
class EventQueueDb {
  EventQueueDb._();
  static final EventQueueDb instance = EventQueueDb._();

  AppDatabase? _db;

  Future<void> init() async {
    if (_db != null) return;

    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'appfy_events.db'));

    _db = AppDatabase(NativeDatabase(file));
  }

  AppDatabase get db {
    if (_db == null) {
      throw StateError('EventQueueDb not initialized');
    }
    return _db!;
  }

  /// Add event to queue
  Future<void> enqueue(QueuedEvent event) async {
    await db.into(db.events).insert(EventsCompanion.insert(
      eventId: event.eventId,
      name: event.name,
      propsJson: jsonEncode(event.props),
      timestamp: event.timestamp,
      deviceId: event.deviceId,
      retryCount: Value(event.retryCount),
    ));
  }

  /// Get pending events (oldest first)
  Future<List<QueuedEvent>> getPending({int limit = 50}) async {
    final query = db.select(db.events)
      ..orderBy([(t) => OrderingTerm.asc(t.createdAt)])
      ..limit(limit);

    final rows = await query.get();
    return rows.map((row) => QueuedEvent(
      eventId: row.eventId,
      name: row.name,
      props: jsonDecode(row.propsJson) as Map<String, dynamic>,
      timestamp: row.timestamp,
      deviceId: row.deviceId,
      retryCount: row.retryCount,
    )).toList();
  }

  /// Remove event from queue
  Future<void> remove(String eventId) async {
    await (db.delete(db.events)
      ..where((t) => t.eventId.equals(eventId)))
      .go();
  }

  /// Get queue size
  Future<int> getQueueSize() async {
    final count = db.events.eventId.count();
    final query = db.selectOnly(db.events)..addColumns([count]);
    final result = await query.getSingle();
    return result.read(count) ?? 0;
  }

  // Favorites methods
  Future<void> addFavorite(String productId, Map<String, dynamic> product) async {
    await db.into(db.favorites).insertOnConflictUpdate(FavoritesCompanion.insert(
      productId: productId,
      productJson: jsonEncode(product),
    ));
  }

  Future<void> removeFavorite(String productId) async {
    await (db.delete(db.favorites)
      ..where((t) => t.productId.equals(productId)))
      .go();
  }

  Future<List<Map<String, dynamic>>> getFavorites() async {
    final rows = await db.select(db.favorites).get();
    return rows.map((row) => jsonDecode(row.productJson) as Map<String, dynamic>).toList();
  }

  Future<bool> isFavorite(String productId) async {
    final query = db.select(db.favorites)
      ..where((t) => t.productId.equals(productId));
    final result = await query.getSingleOrNull();
    return result != null;
  }

  // Push inbox methods
  Future<void> addPushMessage(String messageId, String title, String body, Map<String, dynamic>? data) async {
    await db.into(db.pushInbox).insertOnConflictUpdate(PushInboxCompanion.insert(
      messageId: messageId,
      title: title,
      body: body,
      dataJson: Value(data != null ? jsonEncode(data) : null),
    ));
  }

  Future<void> markPushRead(String messageId) async {
    await (db.update(db.pushInbox)
      ..where((t) => t.messageId.equals(messageId)))
      .write(const PushInboxCompanion(isRead: Value(true)));
  }

  Future<List<Map<String, dynamic>>> getPushInbox({int limit = 50}) async {
    final query = db.select(db.pushInbox)
      ..orderBy([(t) => OrderingTerm.desc(t.receivedAt)])
      ..limit(limit);

    final rows = await query.get();
    return rows.map((row) => {
      'message_id': row.messageId,
      'title': row.title,
      'body': row.body,
      'data': row.dataJson != null ? jsonDecode(row.dataJson!) : null,
      'is_read': row.isRead,
      'received_at': row.receivedAt.toIso8601String(),
    }).toList();
  }

  Future<int> getUnreadCount() async {
    final count = db.pushInbox.messageId.count();
    final query = db.selectOnly(db.pushInbox)
      ..addColumns([count])
      ..where(db.pushInbox.isRead.equals(false));
    final result = await query.getSingle();
    return result.read(count) ?? 0;
  }
}
