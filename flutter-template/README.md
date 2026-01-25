# AppFy Store - Flutter Template

This is the white-label Flutter app template for AppFy. It's automatically built and customized by Codemagic for each store.

## How It Works

1. **Console** triggers a build via the AppFy API
2. **API** queues a build job and calls Codemagic API
3. **Codemagic** clones this repo and injects build variables via `--dart-define`
4. **App** is compiled with store-specific configuration baked in
5. **Codemagic** notifies AppFy via webhook when build completes
6. **AppFy** downloads artifact and stores it in R2 for download

## Build Variables

These variables are injected at build time via `--dart-define`:

| Variable | Description |
|----------|-------------|
| `APPFY_APP_ID` | App ID in AppFy |
| `APPFY_STORE_ID` | Store ID in AppFy |
| `APP_NAME` | Display name of the app |
| `BUNDLE_ID` | Package name (e.g., com.store.app) |
| `VERSION_NAME` | Version string (e.g., 1.0.0) |
| `VERSION_CODE` | Build number |
| `API_BASE_URL` | AppFy API URL |
| `PRIMARY_DOMAIN` | Store's primary domain |
| `ONESIGNAL_APP_ID` | OneSignal App ID for push |
| `RC_PUBLIC_KEY` | Ed25519 public key for Remote Config |

## Project Structure

```
lib/
├── config/
│   └── app_config.dart     # Build-time configuration
├── services/
│   ├── api_service.dart    # HTTP client for AppFy API
│   ├── push_service.dart   # OneSignal push notifications
│   └── remote_config_service.dart  # Remote config with signature verification
├── models/                 # Data models
├── providers/              # Riverpod providers
├── screens/               # Screen widgets
├── widgets/               # Reusable widgets
└── main.dart              # App entry point
```

## Local Development

1. Copy `.env.example` to `.env` and fill in values
2. Run `flutter pub get`
3. Run `flutter run` with dart-define flags:

```bash
flutter run \
  --dart-define=APPFY_APP_ID=test-app \
  --dart-define=APPFY_STORE_ID=test-store \
  --dart-define=APP_NAME="Test Store" \
  --dart-define=BUNDLE_ID=com.test.store \
  --dart-define=API_BASE_URL=http://localhost:3000/v1 \
  --dart-define=PRIMARY_DOMAIN=test.myshopify.com
```

## Codemagic Workflows

- `android-release` - Production APK with signing
- `ios-release` - Production IPA with signing
- `android-debug` - Debug APK for testing

## Features

- **Product Catalog** - Browse products from store
- **Cart** - Add/remove items
- **Checkout** - WebView-based checkout
- **Push Notifications** - OneSignal integration
- **Remote Config** - Server-controlled feature flags
- **Event Tracking** - Analytics via AppFy API
- **Deep Linking** - Push notification actions

## Dependencies

- `flutter_riverpod` - State management
- `dio` - HTTP client
- `onesignal_flutter` - Push notifications
- `cryptography` - Ed25519 signature verification
- `go_router` - Navigation
- `cached_network_image` - Image caching
