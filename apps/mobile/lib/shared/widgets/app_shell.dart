import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/remote_config_provider.dart';

/// Main app shell with bottom navigation tabs
class AppShell extends ConsumerWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remoteConfig = ref.watch(remoteConfigProvider);
    final modules = remoteConfig.valueOrNull?.modules ?? {};

    // Build tabs based on enabled modules
    final tabs = <_TabItem>[];

    if (_isModuleEnabled(modules, 'home')) {
      tabs.add(const _TabItem(
        path: '/',
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: 'Home',
      ));
    }

    if (_isModuleEnabled(modules, 'search')) {
      tabs.add(const _TabItem(
        path: '/search',
        icon: Icons.search_outlined,
        activeIcon: Icons.search,
        label: 'Search',
      ));
    }

    if (_isModuleEnabled(modules, 'favorites')) {
      tabs.add(const _TabItem(
        path: '/favorites',
        icon: Icons.favorite_outline,
        activeIcon: Icons.favorite,
        label: 'Favorites',
      ));
    }

    if (_isModuleEnabled(modules, 'account')) {
      tabs.add(const _TabItem(
        path: '/account',
        icon: Icons.person_outline,
        activeIcon: Icons.person,
        label: 'Account',
      ));
    }

    if (_isModuleEnabled(modules, 'notifications')) {
      tabs.add(const _TabItem(
        path: '/notifications',
        icon: Icons.notifications_outlined,
        activeIcon: Icons.notifications,
        label: 'Inbox',
      ));
    }

    // Determine current index
    final location = GoRouterState.of(context).uri.path;
    var currentIndex = tabs.indexWhere((tab) => tab.path == location);
    if (currentIndex < 0) currentIndex = 0;

    return Scaffold(
      body: child,
      bottomNavigationBar: tabs.length > 1
          ? BottomNavigationBar(
              currentIndex: currentIndex,
              type: BottomNavigationBarType.fixed,
              onTap: (index) {
                final tab = tabs[index];
                context.go(tab.path);
              },
              items: tabs.map((tab) {
                final isActive = tabs.indexOf(tab) == currentIndex;
                return BottomNavigationBarItem(
                  icon: Icon(isActive ? tab.activeIcon : tab.icon),
                  label: tab.label,
                );
              }).toList(),
            )
          : null,
    );
  }

  bool _isModuleEnabled(Map<String, dynamic> modules, String key) {
    final module = modules[key] as Map<String, dynamic>?;
    return module?['enabled'] ?? true;
  }
}

class _TabItem {
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _TabItem({
    required this.path,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
