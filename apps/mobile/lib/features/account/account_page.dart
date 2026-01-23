import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/config/remote_config_provider.dart';
import '../../core/bridge/webview_bridge.dart';

/// Account page - native header + WebView for account content
class AccountPage extends ConsumerStatefulWidget {
  const AccountPage({super.key});

  @override
  ConsumerState<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends ConsumerState<AccountPage> {
  WebViewController? _webViewController;
  int _selectedTab = 0;

  final _tabs = [
    const _AccountTab(label: 'Orders', path: '/account/orders'),
    const _AccountTab(label: 'Profile', path: '/account'),
    const _AccountTab(label: 'Addresses', path: '/account/addresses'),
  ];

  @override
  Widget build(BuildContext context) {
    final remoteConfig = ref.watch(remoteConfigProvider);
    final primaryDomain =
        remoteConfig.valueOrNull?.primaryDomains.first ?? AppConfig.primaryDomain;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => _showSettings(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Tab bar
          Container(
            color: Theme.of(context).colorScheme.surface,
            child: Row(
              children: _tabs.asMap().entries.map((entry) {
                final index = entry.key;
                final tab = entry.value;
                final isSelected = index == _selectedTab;

                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedTab = index;
                      });
                      _loadAccountPage(primaryDomain, tab.path);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: isSelected
                                ? Theme.of(context).colorScheme.primary
                                : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        tab.label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: isSelected
                              ? Theme.of(context).colorScheme.primary
                              : Colors.grey,
                          fontWeight:
                              isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          // WebView content
          Expanded(
            child: _buildWebView(primaryDomain),
          ),
        ],
      ),
    );
  }

  Widget _buildWebView(String primaryDomain) {
    final bridge = WebViewBridge(ref);

    _webViewController ??= WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel(
        'AppFyBridge',
        onMessageReceived: (message) {
          bridge.handleMessage(message.message, _webViewController!);
        },
      )
      ..loadRequest(Uri.parse('$primaryDomain${_tabs[_selectedTab].path}'));

    return WebViewWidget(controller: _webViewController!);
  }

  void _loadAccountPage(String primaryDomain, String path) {
    _webViewController?.loadRequest(Uri.parse('$primaryDomain$path'));
  }

  void _showSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Push Notifications'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                // TODO: Navigate to push settings
              },
            ),
            ListTile(
              leading: const Icon(Icons.language),
              title: const Text('Language'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                // TODO: Navigate to language settings
              },
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('About'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                _showAbout(context);
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Log out', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(context);
                // TODO: Handle logout
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showAbout(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: 'AppFy',
      applicationVersion: AppConfig.appVersion,
      applicationLegalese: '© 2026 AppFy. All rights reserved.',
    );
  }
}

class _AccountTab {
  final String label;
  final String path;

  const _AccountTab({required this.label, required this.path});
}
