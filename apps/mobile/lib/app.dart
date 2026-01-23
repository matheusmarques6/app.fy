import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/config/remote_config_provider.dart';
import 'core/api/auth_provider.dart';
import 'features/home/home_page.dart';
import 'features/search/search_page.dart';
import 'features/favorites/favorites_page.dart';
import 'features/account/account_page.dart';
import 'features/notifications/notifications_page.dart';
import 'shared/widgets/app_shell.dart';

// Router configuration
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/',
            name: 'home',
            builder: (context, state) => const HomePage(),
          ),
          GoRoute(
            path: '/search',
            name: 'search',
            builder: (context, state) => const SearchPage(),
          ),
          GoRoute(
            path: '/favorites',
            name: 'favorites',
            builder: (context, state) => const FavoritesPage(),
          ),
          GoRoute(
            path: '/account',
            name: 'account',
            builder: (context, state) => const AccountPage(),
          ),
          GoRoute(
            path: '/notifications',
            name: 'notifications',
            builder: (context, state) => const NotificationsPage(),
          ),
        ],
      ),
    ],
  );
});

class AppFyApp extends ConsumerStatefulWidget {
  const AppFyApp({super.key});

  @override
  ConsumerState<AppFyApp> createState() => _AppFyAppState();
}

class _AppFyAppState extends ConsumerState<AppFyApp> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // 1. Bootstrap device (get tokens)
    await ref.read(authProvider.notifier).bootstrap();

    // 2. Fetch remote config
    await ref.read(remoteConfigProvider.notifier).fetch();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final remoteConfig = ref.watch(remoteConfigProvider);

    // Get theme from remote config
    final themeData = _buildTheme(remoteConfig.valueOrNull);

    return MaterialApp.router(
      title: 'AppFy',
      debugShowCheckedModeBanner: false,
      theme: themeData,
      routerConfig: router,
    );
  }

  ThemeData _buildTheme(RemoteConfigState? config) {
    // Default theme
    var primaryColor = const Color(0xFF3B82F6); // Blue
    var backgroundColor = const Color(0xFF111827); // Dark gray

    if (config != null && config.config != null) {
      final theme = config.config!['theme'] as Map<String, dynamic>?;
      if (theme != null) {
        final colors = theme['colors'] as Map<String, dynamic>?;
        if (colors != null) {
          final primary = colors['primary'] as String?;
          final background = colors['background'] as String?;
          if (primary != null) {
            primaryColor = _parseColor(primary) ?? primaryColor;
          }
          if (background != null) {
            backgroundColor = _parseColor(background) ?? backgroundColor;
          }
        }
      }
    }

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: primaryColor,
        secondary: primaryColor,
        surface: backgroundColor,
      ),
      scaffoldBackgroundColor: backgroundColor,
      appBarTheme: AppBarTheme(
        backgroundColor: backgroundColor,
        elevation: 0,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: backgroundColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: Colors.grey,
      ),
    );
  }

  Color? _parseColor(String hex) {
    try {
      final buffer = StringBuffer();
      if (hex.length == 6 || hex.length == 7) buffer.write('ff');
      buffer.write(hex.replaceFirst('#', ''));
      return Color(int.parse(buffer.toString(), radix: 16));
    } catch (e) {
      return null;
    }
  }
}
