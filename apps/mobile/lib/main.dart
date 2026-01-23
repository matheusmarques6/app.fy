import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/storage/secure_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock orientation to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize secure storage
  await SecureStorage.instance.init();

  // Initialize OneSignal
  await _initOneSignal();

  runApp(
    const ProviderScope(
      child: AppFyApp(),
    ),
  );
}

Future<void> _initOneSignal() async {
  // OneSignal initialization
  // App ID will come from Remote Config, but we need to init early
  OneSignal.Debug.setLogLevel(OSLogLevel.verbose);

  // The actual app ID will be set after fetching remote config
  // For now, we initialize with a placeholder that will be updated
  final appId = AppConfig.oneSignalAppId;
  if (appId.isNotEmpty) {
    OneSignal.initialize(appId);

    // Request push permission
    OneSignal.Notifications.requestPermission(true);
  }
}
