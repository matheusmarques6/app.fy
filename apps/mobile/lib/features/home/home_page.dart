import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/config/remote_config_provider.dart';
import '../../core/bridge/webview_bridge.dart';

/// Home page with WebView
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  late WebViewController _controller;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    final remoteConfig = ref.read(remoteConfigProvider);
    final configState = remoteConfig.valueOrNull;

    // Get allowlist from remote config
    final primaryDomains = configState?.primaryDomains ?? [AppConfig.primaryDomain];
    final paymentDomains = configState?.paymentDomains ?? [];
    final assetDomains = configState?.assetDomains ?? [];

    // Create bridge
    final bridge = WebViewBridge(ref);

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            setState(() {
              _isLoading = true;
              _error = null;
            });
          },
          onPageFinished: (url) {
            setState(() {
              _isLoading = false;
            });
            // Inject bridge script
            _injectBridgeScript();
          },
          onWebResourceError: (error) {
            setState(() {
              _isLoading = false;
              _error = error.description;
            });
          },
          // CRITICAL: Navigation decision - allowlist enforcement
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) {
              return NavigationDecision.prevent;
            }

            final host = uri.host.toLowerCase();
            final scheme = uri.scheme.toLowerCase();

            // Block dangerous schemes
            if (scheme == 'javascript' ||
                scheme == 'file' ||
                scheme == 'data') {
              return NavigationDecision.prevent;
            }

            // Allow primary domains
            for (final domain in primaryDomains) {
              if (_matchesDomain(host, domain)) {
                return NavigationDecision.navigate;
              }
            }

            // Payment domains - open in external browser
            for (final domain in paymentDomains) {
              if (_matchesDomain(host, domain)) {
                _openExternalBrowser(request.url);
                return NavigationDecision.prevent;
              }
            }

            // Asset domains - allow only for resources, not navigation
            // Since this is top-level navigation, prevent it
            for (final domain in assetDomains) {
              if (_matchesDomain(host, domain)) {
                return NavigationDecision.prevent;
              }
            }

            // Default: open in external browser
            _openExternalBrowser(request.url);
            return NavigationDecision.prevent;
          },
        ),
      )
      // Add JavaScript channel for bridge
      ..addJavaScriptChannel(
        'AppFyBridge',
        onMessageReceived: (message) {
          bridge.handleMessage(message.message, _controller);
        },
      );

    // Load initial URL
    _controller.loadRequest(Uri.parse(AppConfig.primaryDomain));
  }

  bool _matchesDomain(String host, String allowedDomain) {
    final allowed = allowedDomain.toLowerCase().replaceFirst('https://', '').replaceFirst('http://', '');

    // Exact match
    if (host == allowed) return true;

    // Subdomain match (host ends with .allowed)
    if (host.endsWith('.$allowed')) return true;

    // www variant
    if (host == 'www.$allowed' || allowed == 'www.$host') return true;

    return false;
  }

  void _openExternalBrowser(String url) {
    // TODO: Use url_launcher to open external browser
    // For payment domains, use SFSafariViewController / Custom Tabs
  }

  Future<void> _injectBridgeScript() async {
    const bridgeScript = '''
      (function() {
        if (window.AppFy) return; // Already injected

        window.AppFy = {
          // Track event
          trackEvent: function(name, props) {
            AppFyBridge.postMessage(JSON.stringify({
              type: 'trackEvent',
              data: { name: name, props: props || {} }
            }));
          },

          // Request navigation to internal route
          requestNavigation: function(route) {
            AppFyBridge.postMessage(JSON.stringify({
              type: 'requestNavigation',
              data: { route: route }
            }));
          },

          // Set identity hint (not confirmed until webhook)
          setIdentityHint: function(customerId, emailHash) {
            AppFyBridge.postMessage(JSON.stringify({
              type: 'setIdentityHint',
              data: {
                customer_id: customerId,
                email_hash: emailHash
              }
            }));
          },

          // Get device info
          getDeviceInfo: function(callback) {
            // Callback will be called with device info
            window._appfyDeviceCallback = callback;
            AppFyBridge.postMessage(JSON.stringify({
              type: 'getDeviceInfo'
            }));
          }
        };

        // Notify site that bridge is ready
        window.dispatchEvent(new Event('appfy:ready'));
      })();
    ''';

    await _controller.runJavaScript(bridgeScript);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AppFy'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _controller.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(),
            ),
          if (_error != null)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => _controller.reload(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
