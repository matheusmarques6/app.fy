# AppFy Mobile

Flutter app for AppFy - E-commerce App Builder.

## Setup

1. Install Flutter SDK (>= 3.2.0)
2. Run `flutter pub get`
3. Generate database code: `dart run build_runner build`

## Build Configuration

The app uses compile-time environment variables:

```bash
flutter build apk \
  --dart-define=APP_ID=your-app-id \
  --dart-define=STORE_ID=your-store-id \
  --dart-define=API_BASE_URL=https://api.appfy.com/v1 \
  --dart-define=PRIMARY_DOMAIN=https://your-store.com \
  --dart-define=ONESIGNAL_APP_ID=your-onesignal-id \
  --dart-define=RC_PUBLIC_KEY=your-remote-config-public-key
```

## Architecture

- **core/** - Core services (API, storage, config, bridge)
- **features/** - Feature modules (home, search, favorites, account, notifications)
- **shared/** - Shared widgets and utilities

## Key Features

- WebView with domain allowlist lockdown
- JS Bridge for tracking events
- Offline event queue (SQLite)
- OneSignal push notifications
- Deep links (custom scheme + Universal Links)
- Remote Config with signature validation
