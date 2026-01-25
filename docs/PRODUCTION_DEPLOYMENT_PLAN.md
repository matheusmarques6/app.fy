# AppFy - Plano de Deploy para Produção

## Visão Geral

Este documento detalha as 4 etapas necessárias para colocar o AppFy em produção:

1. **Storage (Cloudflare R2)** - Armazenamento de assets e credenciais
2. **Codemagic Integration** - Build real de apps Flutter
3. **Flutter Template** - App mobile white-label
4. **Deploy** - Infraestrutura de produção

---

## Fase 1: Storage (Cloudflare R2)

### Objetivo
Configurar Cloudflare R2 para armazenar:
- Ícones do app (17 tamanhos processados)
- Splash screens
- Certificados iOS/Android (encriptados)
- Artefatos de build (APK/IPA)

### Por que R2?
- Compatível com S3 API
- Egress gratuito (sem custo de bandwidth)
- $0.015/GB/mês (muito mais barato que S3)
- Integração nativa com Cloudflare CDN

### Checklist

- [ ] **1.1 Criar conta Cloudflare** (se não tiver)
  - Acessar https://dash.cloudflare.com
  - Criar conta ou fazer login

- [ ] **1.2 Criar bucket R2**
  ```
  Nome: appfy-assets
  Região: Auto (ENAM para América)
  ```

- [ ] **1.3 Gerar API Token**
  - R2 > Manage R2 API Tokens
  - Create API Token
  - Permissões: Object Read & Write
  - Copiar: Account ID, Access Key ID, Secret Access Key

- [ ] **1.4 Configurar Custom Domain (opcional)**
  - R2 > appfy-assets > Settings > Custom Domains
  - Adicionar: `cdn.appfy.com` ou similar
  - Isso permite URLs públicas bonitas

- [ ] **1.5 Configurar CORS**
  ```json
  [
    {
      "AllowedOrigins": ["https://console.appfy.com", "http://localhost:5173"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- [ ] **1.6 Atualizar variáveis de ambiente**
  ```env
  S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=<ACCESS_KEY_ID>
  S3_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
  S3_BUCKET=appfy-assets
  S3_REGION=auto
  S3_PUBLIC_URL=https://cdn.appfy.com  # Se tiver custom domain
  ```

### Mudanças no Código

**Nenhuma mudança necessária!** O código já está preparado para S3/R2.

Arquivos relevantes:
- `apps/api/src/common/storage/storage.service.ts` - Já usa AWS SDK v3
- `apps/api/src/modules/assets/assets.service.ts` - Upload de ícones/splash
- `apps/api/src/modules/credentials/credentials.service.ts` - Armazena certificados

### Teste Local com MinIO (opcional)

```bash
# Rodar MinIO localmente para testar
docker run -d \
  --name appfy-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Criar bucket via console: http://localhost:9001
# Atualizar .env.local:
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=appfy-dev
S3_REGION=us-east-1
```

---

## Fase 2: Codemagic Integration

### Objetivo
Integrar Codemagic para compilar apps Flutter automaticamente quando o usuário clica em "Build".

### Por que Codemagic?
- Especializado em Flutter
- macOS para builds iOS
- API REST completa
- Plano gratuito: 500 min/mês
- Plano Pay-as-you-go: $0.038/min (Mac Mini M2)

### Fluxo de Build

```
Console UI         API              Codemagic           R2
    |               |                   |               |
    |--Build req--->|                   |               |
    |               |--POST /builds---->|               |
    |               |<--build_id--------|               |
    |               |                   |               |
    |               |   (polling/webhook)               |
    |               |<--status: running-|               |
    |               |<--status: success-|               |
    |               |                   |--upload APK-->|
    |<--completed---|                   |               |
    |               |                   |               |
```

### Checklist

- [ ] **2.1 Criar conta Codemagic**
  - Acessar https://codemagic.io
  - Sign up com GitHub/GitLab/Bitbucket

- [ ] **2.2 Gerar API Token**
  - Settings > Integrations > Codemagic API
  - Generate token
  - Guardar: `CM_API_TOKEN`

- [ ] **2.3 Criar repositório do Flutter Template**
  - Criar repo privado: `appfy/flutter-app-template`
  - Será usado como base para builds

- [ ] **2.4 Configurar workflow no Codemagic**
  - Pode ser via `codemagic.yaml` no repo
  - Ou via API ao iniciar build

- [ ] **2.5 Implementar CodemagicService**

```typescript
// apps/api/src/common/codemagic/codemagic.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface BuildParams {
  appId: string;
  platform: 'ios' | 'android';
  versionName: string;
  versionCode: number;
  buildType: 'debug' | 'release';

  // Dart defines
  storeId: string;
  apiBaseUrl: string;
  oneSignalAppId?: string;
  rcPublicKey?: string;

  // Signing
  keystoreBase64?: string;  // Android
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  p12Base64?: string;       // iOS
  p12Password?: string;
  provisioningBase64?: string;
}

interface BuildResponse {
  buildId: string;
  status: 'queued' | 'building' | 'finished' | 'failed';
}

@Injectable()
export class CodemagicService {
  private readonly logger = new Logger(CodemagicService.name);
  private readonly apiUrl = 'https://api.codemagic.io';
  private readonly token: string;
  private readonly appId: string; // Codemagic App ID

  constructor(private readonly config: ConfigService) {
    this.token = config.get('CODEMAGIC_API_TOKEN') || '';
    this.appId = config.get('CODEMAGIC_APP_ID') || '';
  }

  async startBuild(params: BuildParams): Promise<BuildResponse> {
    const response = await fetch(`${this.apiUrl}/builds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': this.token,
      },
      body: JSON.stringify({
        appId: this.appId,
        workflowId: params.platform === 'ios' ? 'ios-release' : 'android-release',
        branch: 'main',
        environment: {
          variables: {
            // App identification
            APP_ID: params.appId,
            STORE_ID: params.storeId,
            APP_VERSION: params.versionName,
            APP_BUILD_NUMBER: String(params.versionCode),

            // API config
            API_BASE_URL: params.apiBaseUrl,
            ONESIGNAL_APP_ID: params.oneSignalAppId || '',
            RC_PUBLIC_KEY: params.rcPublicKey || '',

            // Android signing
            CM_KEYSTORE: params.keystoreBase64 || '',
            CM_KEYSTORE_PASSWORD: params.keystorePassword || '',
            CM_KEY_ALIAS: params.keyAlias || '',
            CM_KEY_PASSWORD: params.keyPassword || '',

            // iOS signing
            CM_CERTIFICATE: params.p12Base64 || '',
            CM_CERTIFICATE_PASSWORD: params.p12Password || '',
            CM_PROVISIONING_PROFILE: params.provisioningBase64 || '',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Codemagic API error: ${error}`);
    }

    const data = await response.json();
    return {
      buildId: data._id,
      status: 'queued',
    };
  }

  async getBuildStatus(buildId: string): Promise<{
    status: 'queued' | 'building' | 'finished' | 'failed';
    artifactUrl?: string;
    logUrl?: string;
    error?: string;
  }> {
    const response = await fetch(`${this.apiUrl}/builds/${buildId}`, {
      headers: {
        'x-auth-token': this.token,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get build status');
    }

    const data = await response.json();

    // Map Codemagic status to our status
    let status: 'queued' | 'building' | 'finished' | 'failed';
    switch (data.status) {
      case 'queued':
      case 'preparing':
        status = 'queued';
        break;
      case 'building':
      case 'testing':
      case 'publishing':
        status = 'building';
        break;
      case 'finished':
        status = 'finished';
        break;
      default:
        status = 'failed';
    }

    // Find artifact URL
    let artifactUrl: string | undefined;
    if (data.artefacts?.length > 0) {
      const artifact = data.artefacts.find(
        (a: any) => a.type === 'apk' || a.type === 'ipa'
      );
      artifactUrl = artifact?.url;
    }

    return {
      status,
      artifactUrl,
      logUrl: data.buildLogUrl,
      error: data.status === 'failed' ? data.message : undefined,
    };
  }

  async cancelBuild(buildId: string): Promise<void> {
    await fetch(`${this.apiUrl}/builds/${buildId}/cancel`, {
      method: 'POST',
      headers: {
        'x-auth-token': this.token,
      },
    });
  }
}
```

- [ ] **2.6 Atualizar BuildProcessor**

```typescript
// apps/api/src/workers/processors/build.processor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { CodemagicService } from '../../common/codemagic/codemagic.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@appfy/shared';

interface BuildJobData {
  buildJobId: string;
  appId: string;
  appVersionId: string;
  platform: 'ios' | 'android';
  storeId: string;
}

@Processor(QUEUE_NAMES.BUILD)
@Injectable()
export class BuildProcessor extends WorkerHost {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    private readonly codemagic: CodemagicService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<BuildJobData>): Promise<void> {
    const { buildJobId, appId, appVersionId, platform, storeId } = job.data;

    this.logger.log(`Processing build job ${buildJobId} for ${platform}`);

    try {
      // Update status to running
      await this.prisma.buildJob.update({
        where: { id: buildJobId },
        data: { status: 'running', started_at: new Date() },
      });

      // Get app and version info
      const [app, version, credentials] = await Promise.all([
        this.prisma.app.findUnique({ where: { id: appId } }),
        this.prisma.appVersion.findUnique({ where: { id: appVersionId } }),
        this.prisma.appCredential.findMany({
          where: { app_id: appId, platform },
        }),
      ]);

      if (!app || !version) {
        throw new Error('App or version not found');
      }

      // Get signing credentials
      const credential = credentials[0];
      let signingParams: any = {};

      if (platform === 'android' && credential) {
        // Download and decrypt keystore
        const keystoreKey = JSON.parse(credential.secret_ref).keystore;
        const encryptedKeystore = await this.storage.download(keystoreKey);
        const keystore = this.encryption.decryptPacked(encryptedKeystore);

        const metadata = credential.metadata as any;
        signingParams = {
          keystoreBase64: keystore.toString('base64'),
          keystorePassword: metadata.keystorePassword,
          keyAlias: metadata.keyAlias,
          keyPassword: metadata.keyPassword,
        };
      } else if (platform === 'ios' && credential) {
        // Download and decrypt iOS credentials
        const refs = JSON.parse(credential.secret_ref);

        const [encryptedP12, encryptedProvisioning] = await Promise.all([
          this.storage.download(refs.p12),
          this.storage.download(refs.provisioning),
        ]);

        const p12 = this.encryption.decryptPacked(encryptedP12);
        const provisioning = this.encryption.decryptPacked(encryptedProvisioning);

        const metadata = credential.metadata as any;
        signingParams = {
          p12Base64: p12.toString('base64'),
          p12Password: metadata.password,
          provisioningBase64: provisioning.toString('base64'),
        };
      }

      // Start Codemagic build
      const buildResult = await this.codemagic.startBuild({
        appId,
        platform,
        versionName: version.version_name,
        versionCode: version.version_code,
        buildType: 'release',
        storeId,
        apiBaseUrl: this.config.get('API_PUBLIC_URL') || 'https://api.appfy.com/v1',
        oneSignalAppId: app.onesignal_app_id || undefined,
        rcPublicKey: app.rc_public_key || undefined,
        ...signingParams,
      });

      // Update with external build ID
      await this.prisma.buildJob.update({
        where: { id: buildJobId },
        data: { external_build_id: buildResult.buildId },
      });

      // Poll for completion (or use webhook in production)
      await this.pollBuildStatus(buildJobId, buildResult.buildId, appVersionId);

    } catch (error) {
      this.logger.error(`Build ${buildJobId} failed:`, error);

      await this.prisma.buildJob.update({
        where: { id: buildJobId },
        data: {
          status: 'failed',
          completed_at: new Date(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  private async pollBuildStatus(
    buildJobId: string,
    externalBuildId: string,
    appVersionId: string,
  ): Promise<void> {
    const maxAttempts = 120; // 1 hour max (30s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s
      attempts++;

      const status = await this.codemagic.getBuildStatus(externalBuildId);

      if (status.status === 'finished') {
        // Download artifact and upload to our R2
        if (status.artifactUrl) {
          const artifactResponse = await fetch(status.artifactUrl);
          const artifactBuffer = Buffer.from(await artifactResponse.arrayBuffer());

          const artifactKey = `builds/${appVersionId}/artifact`;
          await this.storage.upload(artifactKey, artifactBuffer, {
            contentType: status.artifactUrl.includes('.ipa')
              ? 'application/octet-stream'
              : 'application/vnd.android.package-archive',
          });

          await this.prisma.appVersion.update({
            where: { id: appVersionId },
            data: {
              status: 'built',
              artifact_url: artifactKey,
            },
          });
        }

        await this.prisma.buildJob.update({
          where: { id: buildJobId },
          data: {
            status: 'completed',
            completed_at: new Date(),
            log_url: status.logUrl,
          },
        });

        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Build failed on Codemagic');
      }
    }

    throw new Error('Build timed out');
  }
}
```

- [ ] **2.7 Adicionar variáveis de ambiente**
  ```env
  CODEMAGIC_API_TOKEN=<token>
  CODEMAGIC_APP_ID=<app_id>
  API_PUBLIC_URL=https://api.appfy.com/v1
  ```

- [ ] **2.8 Configurar Webhook (opcional, melhor que polling)**
  - Codemagic > App Settings > Webhooks
  - URL: `https://api.appfy.com/v1/webhooks/codemagic`
  - Criar endpoint no API para receber status updates

### Estrutura de Custos Codemagic

| Plano | Minutos | Custo |
|-------|---------|-------|
| Free | 500/mês | $0 |
| Pay-as-you-go | Ilimitado | $0.038/min (M2) |
| Team | 3000/mês | $99/mês |

Build típico Flutter: ~10-15 minutos
- Android: ~10 min = $0.38
- iOS: ~15 min = $0.57

---

## Fase 3: Flutter Template

### Objetivo
Criar o app Flutter white-label que será compilado para cada store.

### Arquitetura do Template

```
flutter-app-template/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── config/
│   │   │   └── app_config.dart      # Dart defines
│   │   ├── api/
│   │   │   └── api_client.dart      # HTTP client
│   │   ├── storage/
│   │   │   └── secure_storage.dart
│   │   └── push/
│   │       └── push_service.dart    # OneSignal
│   ├── features/
│   │   ├── home/
│   │   ├── product/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── account/
│   │   └── webview/                 # WebView para store
│   └── shared/
│       ├── widgets/
│       └── theme/
├── android/
│   └── app/
│       └── build.gradle             # Version from env
├── ios/
│   └── Runner/
│       └── Info.plist
├── pubspec.yaml
└── codemagic.yaml                   # Build config
```

### Checklist

- [ ] **3.1 Criar repositório**
  ```bash
  gh repo create appfy/flutter-app-template --private
  ```

- [ ] **3.2 Estrutura base Flutter**
  ```bash
  flutter create --org com.appfy flutter_app_template
  cd flutter_app_template
  ```

- [ ] **3.3 Adicionar dependências**
  ```yaml
  # pubspec.yaml
  dependencies:
    flutter:
      sdk: flutter

    # State Management
    flutter_riverpod: ^2.4.9

    # HTTP
    dio: ^5.4.0

    # Storage
    flutter_secure_storage: ^9.0.0
    shared_preferences: ^2.2.2

    # Push
    onesignal_flutter: ^5.1.0

    # WebView
    webview_flutter: ^4.4.4

    # UI
    cached_network_image: ^3.3.1
    shimmer: ^3.0.0

    # Utils
    intl: ^0.18.1
    url_launcher: ^6.2.2
  ```

- [ ] **3.4 Implementar AppConfig**
  ```dart
  // lib/core/config/app_config.dart
  class AppConfig {
    AppConfig._();

    static const String appId = String.fromEnvironment(
      'APP_ID',
      defaultValue: 'dev-app-id',
    );

    static const String storeId = String.fromEnvironment(
      'STORE_ID',
      defaultValue: 'dev-store-id',
    );

    static const String apiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000/v1',
    );

    static const String primaryDomain = String.fromEnvironment(
      'PRIMARY_DOMAIN',
      defaultValue: 'https://example.com',
    );

    static const String oneSignalAppId = String.fromEnvironment(
      'ONESIGNAL_APP_ID',
      defaultValue: '',
    );

    static const String remoteConfigPublicKey = String.fromEnvironment(
      'RC_PUBLIC_KEY',
      defaultValue: '',
    );

    static const String appVersion = String.fromEnvironment(
      'APP_VERSION',
      defaultValue: '1.0.0',
    );

    static const int appBuildNumber = int.fromEnvironment(
      'APP_BUILD_NUMBER',
      defaultValue: 1,
    );
  }
  ```

- [ ] **3.5 Implementar API Client**
  ```dart
  // lib/core/api/api_client.dart
  class ApiClient {
    final Dio _dio;
    final SecureStorage _storage;

    ApiClient(this._storage) : _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {
        'X-Store-Id': AppConfig.storeId,
        'X-App-Id': AppConfig.appId,
      },
    )) {
      _dio.interceptors.add(AuthInterceptor(_storage));
    }

    // Device registration
    Future<void> registerDevice(DeviceInfo info) async {
      await _dio.post('/mobile/devices/register', data: info.toJson());
    }

    // Events
    Future<void> trackEvent(String name, Map<String, dynamic> props) async {
      await _dio.post('/mobile/events', data: {
        'name': name,
        'props': props,
        'ts': DateTime.now().toIso8601String(),
      });
    }

    // Remote Config
    Future<RemoteConfig> getRemoteConfig() async {
      final response = await _dio.get('/mobile/config');
      return RemoteConfig.fromJson(response.data);
    }
  }
  ```

- [ ] **3.6 Implementar WebView Store**
  ```dart
  // lib/features/webview/store_webview.dart
  class StoreWebView extends ConsumerWidget {
    @override
    Widget build(BuildContext context, WidgetRef ref) {
      return WebViewWidget(
        controller: WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setNavigationDelegate(NavigationDelegate(
            onNavigationRequest: (request) {
              // Allowlist check
              final uri = Uri.parse(request.url);
              if (_isAllowedDomain(uri.host)) {
                return NavigationDecision.navigate;
              }
              // Open external links in browser
              launchUrl(uri, mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            },
          ))
          ..loadRequest(Uri.parse(AppConfig.primaryDomain)),
      );
    }

    bool _isAllowedDomain(String host) {
      // Check against remote config allowlist
      final allowlist = ref.read(remoteConfigProvider).allowlist;
      return allowlist.any((domain) =>
        host == domain || host.endsWith('.$domain')
      );
    }
  }
  ```

- [ ] **3.7 Implementar Push Service**
  ```dart
  // lib/core/push/push_service.dart
  class PushService {
    Future<void> initialize() async {
      if (AppConfig.oneSignalAppId.isEmpty) return;

      OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
      OneSignal.initialize(AppConfig.oneSignalAppId);

      // Request permission
      await OneSignal.Notifications.requestPermission(true);

      // Set external user ID when logged in
      OneSignal.login(await _getDeviceId());

      // Handle notification clicks
      OneSignal.Notifications.addClickListener((event) {
        _handleNotificationClick(event.notification);
      });
    }

    void _handleNotificationClick(OSNotification notification) {
      final deeplink = notification.additionalData?['deeplink'];
      if (deeplink != null) {
        // Navigate to deeplink
      }
    }
  }
  ```

- [ ] **3.8 Criar codemagic.yaml**
  ```yaml
  # codemagic.yaml
  workflows:
    android-release:
      name: Android Release
      max_build_duration: 30
      environment:
        flutter: stable
        java: 17
        vars:
          STORE_ID: $STORE_ID
          APP_ID: $APP_ID
          API_BASE_URL: $API_BASE_URL
          ONESIGNAL_APP_ID: $ONESIGNAL_APP_ID
          RC_PUBLIC_KEY: $RC_PUBLIC_KEY
          APP_VERSION: $APP_VERSION
          APP_BUILD_NUMBER: $APP_BUILD_NUMBER
      scripts:
        - name: Set up keystore
          script: |
            echo $CM_KEYSTORE | base64 --decode > $CM_BUILD_DIR/keystore.jks
            cat > $CM_BUILD_DIR/key.properties <<EOF
            storePassword=$CM_KEYSTORE_PASSWORD
            keyPassword=$CM_KEY_PASSWORD
            keyAlias=$CM_KEY_ALIAS
            storeFile=$CM_BUILD_DIR/keystore.jks
            EOF
        - name: Build APK
          script: |
            flutter build apk --release \
              --dart-define=STORE_ID=$STORE_ID \
              --dart-define=APP_ID=$APP_ID \
              --dart-define=API_BASE_URL=$API_BASE_URL \
              --dart-define=ONESIGNAL_APP_ID=$ONESIGNAL_APP_ID \
              --dart-define=RC_PUBLIC_KEY=$RC_PUBLIC_KEY \
              --dart-define=APP_VERSION=$APP_VERSION \
              --dart-define=APP_BUILD_NUMBER=$APP_BUILD_NUMBER \
              --build-number=$APP_BUILD_NUMBER \
              --build-name=$APP_VERSION
      artifacts:
        - build/**/outputs/**/*.apk

    ios-release:
      name: iOS Release
      max_build_duration: 45
      instance_type: mac_mini_m2
      environment:
        flutter: stable
        xcode: latest
        cocoapods: default
        vars:
          STORE_ID: $STORE_ID
          APP_ID: $APP_ID
          API_BASE_URL: $API_BASE_URL
          ONESIGNAL_APP_ID: $ONESIGNAL_APP_ID
          RC_PUBLIC_KEY: $RC_PUBLIC_KEY
          APP_VERSION: $APP_VERSION
          APP_BUILD_NUMBER: $APP_BUILD_NUMBER
      scripts:
        - name: Set up code signing
          script: |
            keychain initialize
            app-store-connect fetch-signing-files $(xcode-project detect-bundle-id) \
              --type IOS_APP_STORE \
              --create
            keychain add-certificates
            xcode-project use-profiles
        - name: Build IPA
          script: |
            flutter build ipa --release \
              --dart-define=STORE_ID=$STORE_ID \
              --dart-define=APP_ID=$APP_ID \
              --dart-define=API_BASE_URL=$API_BASE_URL \
              --dart-define=ONESIGNAL_APP_ID=$ONESIGNAL_APP_ID \
              --dart-define=RC_PUBLIC_KEY=$RC_PUBLIC_KEY \
              --dart-define=APP_VERSION=$APP_VERSION \
              --dart-define=APP_BUILD_NUMBER=$APP_BUILD_NUMBER \
              --build-number=$APP_BUILD_NUMBER \
              --build-name=$APP_VERSION \
              --export-options-plist=/Users/builder/export_options.plist
      artifacts:
        - build/ios/ipa/*.ipa
  ```

- [ ] **3.9 Configurar ícone e splash dinâmicos**
  - Ícones são baixados do R2 durante build
  - Usar `flutter_launcher_icons` com config dinâmico

- [ ] **3.10 Testar build local**
  ```bash
  flutter build apk --release \
    --dart-define=STORE_ID=test-store \
    --dart-define=APP_ID=test-app \
    --dart-define=API_BASE_URL=https://api.appfy.com/v1
  ```

---

## Fase 4: Deploy

### Arquitetura de Produção

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (DNS + CDN)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Vercel     │   │    Railway    │   │ Cloudflare R2 │
│   (Console)   │   │     (API)     │   │   (Storage)   │
│   Next.js     │   │    NestJS     │   │  Assets/Certs │
└───────────────┘   │    Workers    │   └───────────────┘
                    │    Redis      │
                    │   Postgres    │
                    └───────────────┘
```

### Checklist

#### 4.1 Railway (API + Workers + DB + Redis)

- [ ] **4.1.1 Criar projeto Railway**
  - https://railway.app
  - New Project > Empty Project

- [ ] **4.1.2 Adicionar PostgreSQL**
  - New > Database > PostgreSQL
  - Copiar `DATABASE_URL`

- [ ] **4.1.3 Adicionar Redis**
  - New > Database > Redis
  - Copiar `REDIS_URL`

- [ ] **4.1.4 Deploy API**
  - New > GitHub Repo > appfy/appfy
  - Root Directory: `apps/api`
  - Build Command: `pnpm build`
  - Start Command: `pnpm start`

  Variáveis de ambiente:
  ```env
  NODE_ENV=production
  PORT=3000
  DATABASE_URL=<from_postgres>
  REDIS_URL=<from_redis>
  JWT_SECRET=<generate_secure>
  JWT_REFRESH_SECRET=<generate_secure>
  CONSOLE_BASE_URL=https://console.appfy.com
  CREDENTIALS_ENCRYPTION_KEY=<generate_32_bytes_hex>
  S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=<r2_key>
  S3_SECRET_ACCESS_KEY=<r2_secret>
  S3_BUCKET=appfy-assets
  S3_REGION=auto
  CODEMAGIC_API_TOKEN=<token>
  CODEMAGIC_APP_ID=<app_id>
  API_PUBLIC_URL=https://api.appfy.com/v1
  ```

- [ ] **4.1.5 Deploy Workers**
  - New > GitHub Repo > appfy/appfy (mesmo repo)
  - Root Directory: `apps/api`
  - Start Command: `pnpm start:workers`
  - Mesmas variáveis de ambiente

- [ ] **4.1.6 Configurar domínio**
  - Settings > Domains > Add Custom Domain
  - `api.appfy.com`
  - Adicionar DNS no Cloudflare

- [ ] **4.1.7 Rodar migrations**
  ```bash
  railway run pnpm prisma migrate deploy
  ```

#### 4.2 Vercel (Console)

- [ ] **4.2.1 Deploy Console**
  - https://vercel.com
  - Import Git Repository > appfy/appfy
  - Root Directory: `apps/console`
  - Framework: Next.js

  Variáveis de ambiente:
  ```env
  NEXT_PUBLIC_API_URL=https://api.appfy.com/v1
  NEXTAUTH_SECRET=<generate_secure>
  NEXTAUTH_URL=https://console.appfy.com
  ```

- [ ] **4.2.2 Configurar domínio**
  - Settings > Domains
  - `console.appfy.com`

#### 4.3 Cloudflare (DNS + CDN)

- [ ] **4.3.1 Adicionar domínio**
  - Add Site > `appfy.com`
  - Seguir instruções para nameservers

- [ ] **4.3.2 Configurar DNS**
  ```
  A     api       <railway_ip>      Proxied
  CNAME console   cname.vercel-dns.com  Proxied
  CNAME cdn       <r2_custom_domain>    Proxied
  ```

- [ ] **4.3.3 Configurar SSL**
  - SSL/TLS > Full (strict)
  - Always Use HTTPS: On

- [ ] **4.3.4 Configurar cache**
  - Cache Rules para assets estáticos

#### 4.4 Monitoramento

- [ ] **4.4.1 Sentry (Erros)**
  ```env
  SENTRY_DSN=<dsn>
  ```

- [ ] **4.4.2 Railway Metrics**
  - Observability > Metrics
  - Configurar alertas

- [ ] **4.4.3 Uptime monitoring**
  - https://betteruptime.com ou similar
  - Monitorar: API health, Console

### Custos Estimados (Produção)

| Serviço | Uso | Custo/mês |
|---------|-----|-----------|
| Railway (API) | ~$5-20 | ~$10 |
| Railway (Workers) | ~$5-10 | ~$7 |
| Railway (Postgres) | 1GB | $5 |
| Railway (Redis) | 500MB | $5 |
| Vercel (Console) | Free tier | $0 |
| Cloudflare R2 | ~10GB | $0.15 |
| Cloudflare (DNS/CDN) | Free | $0 |
| Codemagic | Pay-as-you-go | ~$20-50 |
| **Total** | | **~$50-100/mês** |

---

## Cronograma Sugerido

| Fase | Tarefa | Duração |
|------|--------|---------|
| 1 | Storage (R2) | 2-3 horas |
| 2 | Codemagic Integration | 1-2 dias |
| 3 | Flutter Template | 3-5 dias |
| 4 | Deploy | 1 dia |
| - | Testes E2E | 1-2 dias |
| **Total** | | **~1-2 semanas** |

---

## Ordem de Execução Recomendada

1. **Storage (R2)** - Sem isso, assets não funcionam
2. **Deploy básico** - API/Console online sem builds
3. **Flutter Template** - Criar app base
4. **Codemagic** - Integrar builds
5. **Testes completos** - Fluxo E2E

Isso permite deploy incremental e testes ao longo do caminho.
