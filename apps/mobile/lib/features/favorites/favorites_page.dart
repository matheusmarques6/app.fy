import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/event_queue_db.dart';

/// Favorites provider
final favoritesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return EventQueueDb.instance.getFavorites();
});

/// Favorites page - native list of saved products
class FavoritesPage extends ConsumerWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Favorites'),
      ),
      body: favorites.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Text('Error: $error', style: const TextStyle(color: Colors.red)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.favorite_border, size: 64, color: Colors.grey[600]),
                  const SizedBox(height: 16),
                  Text(
                    'No favorites yet',
                    style: TextStyle(color: Colors.grey[400], fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Save items you like to find them later',
                    style: TextStyle(color: Colors.grey[600], fontSize: 14),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final product = items[index];
              return _FavoriteItem(
                product: product,
                onRemove: () async {
                  final productId = product['id'] as String?;
                  if (productId != null) {
                    await EventQueueDb.instance.removeFavorite(productId);
                    ref.invalidate(favoritesProvider);
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _FavoriteItem extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onRemove;

  const _FavoriteItem({
    required this.product,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final name = product['name'] as String? ?? 'Unknown Product';
    final price = product['price'];
    final imageUrl = product['image_url'] as String?;
    final currency = product['currency'] as String? ?? 'BRL';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: imageUrl != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  imageUrl,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 56,
                    height: 56,
                    color: Colors.grey[800],
                    child: const Icon(Icons.image, color: Colors.grey),
                  ),
                ),
              )
            : Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.grey[800],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.shopping_bag, color: Colors.grey),
              ),
        title: Text(
          name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: price != null
            ? Text(
                _formatPrice(price, currency),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
              )
            : null,
        trailing: IconButton(
          icon: const Icon(Icons.favorite, color: Colors.red),
          onPressed: onRemove,
        ),
        onTap: () {
          // Navigate to product in WebView
          final productId = product['id'] as String?;
          if (productId != null) {
            // TODO: Navigate to product page
          }
        },
      ),
    );
  }

  String _formatPrice(dynamic price, String currency) {
    if (price is int) {
      // Minor units (centavos)
      return '$currency ${(price / 100).toStringAsFixed(2)}';
    } else if (price is double) {
      return '$currency ${price.toStringAsFixed(2)}';
    }
    return '$currency $price';
  }
}
