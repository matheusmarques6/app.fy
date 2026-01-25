import 'package:dio/dio.dart';
import '../config/app_config.dart';

/// API Service for communicating with AppFy backend
class ApiService {
  late final Dio _dio;
  String? _deviceToken;

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'X-Store-Id': AppConfig.storeId,
          'X-App-Id': AppConfig.appId,
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // Add device token if available
          if (_deviceToken != null) {
            options.headers['X-Device-Token'] = _deviceToken;
          }
          return handler.next(options);
        },
        onError: (error, handler) {
          // Handle common errors
          if (error.response?.statusCode == 401) {
            // Token expired, need to refresh
          }
          return handler.next(error);
        },
      ),
    );
  }

  /// Set device token for authenticated requests
  void setDeviceToken(String token) {
    _deviceToken = token;
  }

  /// Register device with AppFy
  Future<Map<String, dynamic>> registerDevice({
    required String oneSignalPlayerId,
    required String platform,
    String? pushToken,
    Map<String, dynamic>? deviceInfo,
  }) async {
    final response = await _dio.post('/mobile/devices/register', data: {
      'onesignal_player_id': oneSignalPlayerId,
      'platform': platform,
      'push_token': pushToken,
      'device_info': deviceInfo,
    });
    return response.data;
  }

  /// Track an event
  Future<void> trackEvent({
    required String eventType,
    Map<String, dynamic>? properties,
  }) async {
    await _dio.post('/mobile/events', data: {
      'event_type': eventType,
      'properties': properties ?? {},
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  /// Get remote config
  Future<Map<String, dynamic>> getRemoteConfig() async {
    final response = await _dio.get('/mobile/remote-config');
    return response.data;
  }

  /// Get store catalog
  Future<Map<String, dynamic>> getCatalog({
    int page = 1,
    int limit = 20,
    String? category,
    String? search,
  }) async {
    final response = await _dio.get('/mobile/catalog', queryParameters: {
      'page': page,
      'limit': limit,
      if (category != null) 'category': category,
      if (search != null) 'search': search,
    });
    return response.data;
  }

  /// Get product details
  Future<Map<String, dynamic>> getProduct(String productId) async {
    final response = await _dio.get('/mobile/catalog/$productId');
    return response.data;
  }

  /// Get categories
  Future<List<dynamic>> getCategories() async {
    final response = await _dio.get('/mobile/categories');
    return response.data;
  }

  /// Get cart
  Future<Map<String, dynamic>> getCart() async {
    final response = await _dio.get('/mobile/cart');
    return response.data;
  }

  /// Add to cart
  Future<Map<String, dynamic>> addToCart({
    required String productId,
    required int quantity,
    String? variantId,
  }) async {
    final response = await _dio.post('/mobile/cart/add', data: {
      'product_id': productId,
      'quantity': quantity,
      if (variantId != null) 'variant_id': variantId,
    });
    return response.data;
  }

  /// Update cart item
  Future<Map<String, dynamic>> updateCartItem({
    required String itemId,
    required int quantity,
  }) async {
    final response = await _dio.put('/mobile/cart/$itemId', data: {
      'quantity': quantity,
    });
    return response.data;
  }

  /// Remove from cart
  Future<void> removeFromCart(String itemId) async {
    await _dio.delete('/mobile/cart/$itemId');
  }

  /// Get checkout URL (for webview)
  Future<String> getCheckoutUrl() async {
    final response = await _dio.post('/mobile/checkout/start');
    return response.data['checkout_url'];
  }
}
