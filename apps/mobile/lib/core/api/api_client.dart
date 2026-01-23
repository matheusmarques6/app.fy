import 'package:dio/dio.dart';
import 'package:logger/logger.dart';

import '../config/app_config.dart';
import '../storage/secure_storage.dart';

/// HTTP API Client with token refresh
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  late final Dio _dio;
  final _logger = Logger();
  bool _isRefreshing = false;

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': AppConfig.appId,
        'X-App-Version': AppConfig.appVersion,
      },
    ));

    // Request interceptor - add auth token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await SecureStorage.instance.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // Handle 401 - try refresh token
        if (error.response?.statusCode == 401 && !_isRefreshing) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            // Retry the original request
            try {
              final opts = error.requestOptions;
              final token = await SecureStorage.instance.getAccessToken();
              opts.headers['Authorization'] = 'Bearer $token';
              final response = await _dio.fetch(opts);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
            }
          }
        }
        return handler.next(error);
      },
    ));

    // Logging interceptor (debug only)
    _dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
      logPrint: (obj) => _logger.d(obj),
    ));
  }

  Future<bool> _refreshToken() async {
    if (_isRefreshing) return false;
    _isRefreshing = true;

    try {
      final refreshToken = await SecureStorage.instance.getRefreshToken();
      if (refreshToken == null) {
        _isRefreshing = false;
        return false;
      }

      final response = await _dio.post(
        '/auth/token/refresh',
        data: {'refresh_token': refreshToken},
        options: Options(headers: {'Authorization': null}),
      );

      if (response.statusCode == 200) {
        final data = response.data;
        await SecureStorage.instance.setAccessToken(data['access_token']);
        await SecureStorage.instance.setRefreshToken(data['refresh_token']);
        _isRefreshing = false;
        return true;
      }
    } catch (e) {
      _logger.e('Token refresh failed', error: e);
      // Clear tokens on refresh failure - force re-register
      await SecureStorage.instance.clearAuth();
    }

    _isRefreshing = false;
    return false;
  }

  // Generic request methods
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
  }
}
