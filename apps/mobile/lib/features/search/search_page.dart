import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/config/remote_config_provider.dart';
import '../../core/bridge/webview_bridge.dart';

/// Search page - native search bar with WebView results
class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  WebViewController? _webViewController;
  bool _showResults = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _performSearch(String query) {
    if (query.isEmpty) {
      setState(() {
        _showResults = false;
      });
      return;
    }

    final remoteConfig = ref.read(remoteConfigProvider);
    final primaryDomain =
        remoteConfig.valueOrNull?.primaryDomains.first ?? AppConfig.primaryDomain;

    // Load search results in WebView
    final searchUrl = Uri.parse(primaryDomain).replace(
      path: '/search',
      queryParameters: {'q': query},
    );

    _webViewController?.loadRequest(searchUrl);

    setState(() {
      _showResults = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search products...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: Colors.grey[400]),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _showResults = false;
                      });
                    },
                  )
                : null,
          ),
          style: const TextStyle(color: Colors.white),
          textInputAction: TextInputAction.search,
          onSubmitted: _performSearch,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _performSearch(_searchController.text),
          ),
        ],
      ),
      body: _showResults ? _buildSearchResults() : _buildSearchSuggestions(),
    );
  }

  Widget _buildSearchSuggestions() {
    // Show popular searches or recent searches
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search, size: 64, color: Colors.grey[600]),
          const SizedBox(height: 16),
          Text(
            'Search for products',
            style: TextStyle(color: Colors.grey[400], fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    final bridge = WebViewBridge(ref);

    _webViewController ??= WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel(
        'AppFyBridge',
        onMessageReceived: (message) {
          bridge.handleMessage(message.message, _webViewController!);
        },
      );

    return WebViewWidget(controller: _webViewController!);
  }
}
