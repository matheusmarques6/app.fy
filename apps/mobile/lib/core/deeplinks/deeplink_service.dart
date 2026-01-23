import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';

import '../config/app_config.dart';
import '../config/remote_config_provider.dart';
import '../bridge/event_tracker.dart';

/// Deep link handling service
class DeepLinkService {
  DeepLinkService._();
  static final DeepLinkService instance = DeepLinkService._();

  final _appLinks = AppLinks();
  final _logger = Logger();
  BuildContext? _context;

  /// Initialize deep link handling
  Future<void> init() async {
    // Handle app opened from deep link (cold start)
    final initialLink = await _appLinks.getInitialLink();
    if (initialLink != null) {
      _handleDeepLink(initialLink);
    }

    // Handle deep links while app is running
    _appLinks.uriLinkStream.listen((uri) {
      _handleDeepLink(uri);
    });
  }

  /// Set context for navigation
  void setContext(BuildContext context) {
    _context = context;
  }

  /// Handle incoming deep link
  Future<void> _handleDeepLink(Uri uri) async {
    _logger.d('Deep link received: $uri');

    // Track deep link event
    await EventTracker.instance.trackEvent('app_open', {
      'source': 'deep_link',
      'url': uri.toString(),
      'host': uri.host,
      'path': uri.path,
      'query': uri.queryParameters,
    });

    // Parse and route the deep link
    await _routeDeepLink(uri);
  }

  /// Route the deep link to appropriate screen
  Future<void> _routeDeepLink(Uri uri) async {
    if (_context == null) {
      _logger.w('Context not set, cannot route deep link');
      return;
    }

    final scheme = uri.scheme.toLowerCase();
    final host = uri.host.toLowerCase();
    final path = uri.path;

    // Handle custom scheme (appfy://...)
    if (scheme == 'appfy') {
      _handleCustomScheme(uri);
      return;
    }

    // Handle Universal Links / App Links (https://...)
    if (scheme == 'https' || scheme == 'http') {
      _handleUniversalLink(uri);
      return;
    }
  }

  /// Handle custom scheme deep links (appfy://...)
  void _handleCustomScheme(Uri uri) {
    final host = uri.host.toLowerCase();
    final path = uri.path;

    switch (host) {
      case 'product':
        // appfy://product/123
        final productId = path.replaceFirst('/', '');
        if (productId.isNotEmpty) {
          _navigateToProduct(productId);
        }
        break;

      case 'collection':
        // appfy://collection/sale
        final collectionId = path.replaceFirst('/', '');
        if (collectionId.isNotEmpty) {
          _navigateToCollection(collectionId);
        }
        break;

      case 'cart':
        // appfy://cart
        _navigateToCart();
        break;

      case 'search':
        // appfy://search?q=shoes
        final query = uri.queryParameters['q'];
        _navigateToSearch(query);
        break;

      case 'orders':
        // appfy://orders or appfy://orders/123
        final orderId = path.isNotEmpty ? path.replaceFirst('/', '') : null;
        _navigateToOrders(orderId);
        break;

      case 'notifications':
        // appfy://notifications
        _context?.go('/notifications');
        break;

      case 'favorites':
        // appfy://favorites
        _context?.go('/favorites');
        break;

      default:
        // Unknown host, go to home
        _context?.go('/');
    }
  }

  /// Handle Universal Links (https://store.com/...)
  void _handleUniversalLink(Uri uri) {
    final path = uri.path.toLowerCase();

    // Product pages
    if (path.startsWith('/products/') || path.startsWith('/product/')) {
      final segments = uri.pathSegments;
      if (segments.length >= 2) {
        _navigateToProduct(segments[1]);
        return;
      }
    }

    // Collection pages
    if (path.startsWith('/collections/') || path.startsWith('/collection/')) {
      final segments = uri.pathSegments;
      if (segments.length >= 2) {
        _navigateToCollection(segments[1]);
        return;
      }
    }

    // Cart
    if (path == '/cart' || path == '/checkout') {
      _navigateToCart();
      return;
    }

    // Search
    if (path == '/search') {
      final query = uri.queryParameters['q'];
      _navigateToSearch(query);
      return;
    }

    // Orders
    if (path.startsWith('/account/orders') || path.startsWith('/orders')) {
      final segments = uri.pathSegments;
      final orderId = segments.length >= 2 ? segments.last : null;
      _navigateToOrders(orderId);
      return;
    }

    // Default: load in home WebView with the URL
    _context?.go('/?url=${Uri.encodeComponent(uri.toString())}');
  }

  void _navigateToProduct(String productId) {
    // Navigate to home and load product in WebView
    _context?.go('/?path=/products/$productId');
  }

  void _navigateToCollection(String collectionId) {
    _context?.go('/?path=/collections/$collectionId');
  }

  void _navigateToCart() {
    _context?.go('/?path=/cart');
  }

  void _navigateToSearch(String? query) {
    _context?.go('/search${query != null ? "?q=$query" : ""}');
  }

  void _navigateToOrders(String? orderId) {
    _context?.go('/account${orderId != null ? "?order=$orderId" : ""}');
  }
}
