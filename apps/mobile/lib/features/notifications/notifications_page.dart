import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/storage/event_queue_db.dart';

/// Push inbox provider
final pushInboxProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return EventQueueDb.instance.getPushInbox();
});

/// Unread count provider
final unreadCountProvider = FutureProvider<int>((ref) async {
  return EventQueueDb.instance.getUnreadCount();
});

/// Notifications page - native push inbox
class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(pushInboxProvider);
    final unreadCount = ref.watch(unreadCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('Notifications'),
            const SizedBox(width: 8),
            unreadCount.when(
              data: (count) => count > 0
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        count.toString(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'mark_all_read') {
                // TODO: Mark all as read
              } else if (value == 'settings') {
                // TODO: Open notification settings
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'mark_all_read',
                child: Text('Mark all as read'),
              ),
              const PopupMenuItem(
                value: 'settings',
                child: Text('Notification settings'),
              ),
            ],
          ),
        ],
      ),
      body: inbox.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Text('Error: $error', style: const TextStyle(color: Colors.red)),
        ),
        data: (messages) {
          if (messages.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none, size: 64, color: Colors.grey[600]),
                  const SizedBox(height: 16),
                  Text(
                    'No notifications yet',
                    style: TextStyle(color: Colors.grey[400], fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We\'ll notify you about orders and promotions',
                    style: TextStyle(color: Colors.grey[600], fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(pushInboxProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                return _NotificationItem(
                  message: message,
                  onTap: () async {
                    final messageId = message['message_id'] as String?;
                    if (messageId != null) {
                      await EventQueueDb.instance.markPushRead(messageId);
                      ref.invalidate(pushInboxProvider);
                      ref.invalidate(unreadCountProvider);
                    }

                    // Handle notification action
                    final data = message['data'] as Map<String, dynamic>?;
                    if (data != null) {
                      // TODO: Navigate based on data (deep link)
                    }
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _NotificationItem extends StatelessWidget {
  final Map<String, dynamic> message;
  final VoidCallback onTap;

  const _NotificationItem({
    required this.message,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final title = message['title'] as String? ?? '';
    final body = message['body'] as String? ?? '';
    final isRead = message['is_read'] as bool? ?? false;
    final receivedAt = message['received_at'] as String?;

    final formattedTime = receivedAt != null
        ? _formatTime(DateTime.parse(receivedAt))
        : '';

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isRead ? null : Theme.of(context).colorScheme.primary.withOpacity(0.1),
          border: Border(
            bottom: BorderSide(
              color: Colors.grey[800]!,
              width: 0.5,
            ),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon/Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                Icons.local_offer,
                color: Theme.of(context).colorScheme.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                            fontSize: 15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        formattedTime,
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Unread indicator
            if (!isRead)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(left: 8, top: 4),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d';
    } else {
      return DateFormat('MMM d').format(time);
    }
  }
}
