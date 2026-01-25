# App Builder - Plano de Implementação Completo

> **Versão 3.0** - Plano completo com assets, OneSignal, keypairs e fluxo detalhado

---

## Índice

1. [Arquitetura Atual](#1-arquitetura-atual)
2. [Arquitetura Alvo](#2-arquitetura-alvo)
3. [Componentes a Implementar](#3-componentes-a-implementar)
4. [Fase 0: Infraestrutura](#fase-0-infraestrutura)
5. [Fase 1: Storage Service](#fase-1-storage-service)
6. [Fase 2: Apps Module](#fase-2-apps-module)
7. [Fase 3: Assets Module](#fase-3-assets-module)
8. [Fase 4: OneSignal Integration](#fase-4-onesignal-integration)
9. [Fase 5: Credentials Module](#fase-5-credentials-module)
10. [Fase 6: Builds Module](#fase-6-builds-module)
11. [Fase 7: UI do Console](#fase-7-ui-do-console)
12. [Fluxo Completo End-to-End](#fluxo-completo-end-to-end)
13. [Resumo de Arquivos](#resumo-de-arquivos)
14. [Estimativas](#estimativas)

---

## 1. Arquitetura Atual

### 1.1 O que já existe

```
apps/mobile/                    # App Flutter white-label ✅
├── lib/
│   ├── main.dart
│   ├── app.dart
│   └── core/
│       ├── config/app_config.dart   # Variáveis de build-time
│       ├── api/                     # Cliente API
│       ├── bridge/                  # JS Bridge para WebView
│       ├── storage/                 # SQLite + Secure Storage
│       ├── push/                    # OneSignal
│       └── deeplinks/               # Deep linking
├── android/
├── ios/
└── pubspec.yaml

apps/api/src/modules/
├── remote-config/              # API de configuração remota ✅
├── stores/                     # CRUD de stores ✅
├── auth/                       # Autenticação ✅
└── ...

apps/console/src/app/(dashboard)/stores/[storeId]/
└── app-builder/page.tsx        # UI de configuração ✅
```

### 1.2 Configuração atual do app Flutter

**Build-time (dart-define):**
```dart
// lib/core/config/app_config.dart
class AppConfig {
  static const String appId = String.fromEnvironment('APP_ID');
  static const String storeId = String.fromEnvironment('STORE_ID');
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String primaryDomain = String.fromEnvironment('PRIMARY_DOMAIN');
  static const String oneSignalAppId = String.fromEnvironment('ONESIGNAL_APP_ID');
  static const String remoteConfigPublicKey = String.fromEnvironment('RC_PUBLIC_KEY');
}
```

**Runtime (Remote Config API):**
- Tema (cores, fontes)
- Módulos habilitados
- Allowlist de domínios
- Feature flags

### 1.3 Status dos componentes

| Componente | Status | Notas |
|------------|--------|-------|
| App Flutter | ✅ | Template funcional |
| Remote Config API | ✅ | Draft/Publish/Versions |
| App Builder UI (config) | ✅ | Tema, módulos, allowlist |
| Schema Prisma (App, AppVersion, etc) | ✅ | Modelos definidos |
| Apps CRUD API | ❌ | Precisa criar |
| Assets Management | ❌ | Ícones, splash |
| OneSignal Integration | ❌ | Criar app por store |
| Credentials API | ❌ | Upload .p12/keystore |
| Storage Service (S3) | ❌ | Para assets e artifacts |
| Build System | ❌ | Worker + CI/CD |
| Remote Config Keypair | ❌ | Ed25519 signing |

---

## 2. Arquitetura Alvo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CONSOLE UI                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Settings   │  │    Assets    │  │ Credentials  │  │    Builds    │    │
│  │              │  │              │  │              │  │              │    │
│  │ • App name   │  │ • App icon   │  │ • iOS cert   │  │ • Trigger    │    │
│  │ • Bundle IDs │  │ • Splash     │  │ • Keystore   │  │ • Status     │    │
│  │ • OneSignal  │  │ • Colors     │  │ • Passwords  │  │ • Logs       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  API                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Apps Module │  │   Assets    │  │ Credentials │  │   Builds    │        │
│  │             │  │   Module    │  │   Module    │  │   Module    │        │
│  │ CRUD + keys │  │ Upload/     │  │ Encrypt/    │  │ Queue jobs  │        │
│  │             │  │ Process     │  │ Validate    │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                      │                                       │
│                                      ▼                                       │
│                          ┌─────────────────────┐                            │
│                          │   Storage Service   │                            │
│                          │   (S3/Cloudflare)   │                            │
│                          └─────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUILD WORKER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Recebe job da queue (BullMQ)                                            │
│  2. Baixa assets do S3 (ícones, splash)                                     │
│  3. Baixa e descriptografa credentials                                       │
│  4. Prepara projeto Flutter:                                                 │
│     - Substitui bundle ID                                                    │
│     - Substitui app name                                                     │
│     - Copia ícones para android/ios                                         │
│     - Configura signing                                                      │
│  5. Executa: flutter build apk/ipa --dart-define=...                        │
│  6. Upload artifact para S3                                                  │
│  7. Notifica completion via webhook                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes a Implementar

### 3.1 Novos módulos backend

| Módulo | Responsabilidade |
|--------|------------------|
| `common/storage` | Upload/download S3, signed URLs |
| `common/encryption` | AES-256-GCM para credentials |
| `modules/apps` | CRUD de apps, keypairs, bundle IDs |
| `modules/assets` | Upload/processamento de ícones e splash |
| `modules/credentials` | Upload de .p12, keystore, validação |
| `modules/builds` | Trigger builds, status, logs |
| `workers/build.processor` | Processar jobs de build |

### 3.2 Novas páginas frontend

| Página | Funcionalidade |
|--------|----------------|
| `app-builder/settings` | Nome, bundle IDs, OneSignal config |
| `app-builder/assets` | Upload ícones e splash screen |
| `app-builder/credentials` | Upload certificados |
| `app-builder/builds` | Lista de builds, trigger, logs |

### 3.3 Serviços externos

| Serviço | Uso |
|---------|-----|
| **Cloudflare R2** | Armazenar assets, credentials, artifacts |
| **OneSignal** | Push notifications (1 app por store) |
| **Codemagic** | CI/CD para builds Flutter |

---

## Fase 0: Infraestrutura

### 0.1 Criar bucket S3/R2

**Estrutura de pastas:**
```
appfy-builds/
├── assets/
│   └── {app_id}/
│       ├── icon.png              # Ícone original (1024x1024)
│       ├── icon_android/         # Ícones processados Android
│       │   ├── mipmap-mdpi/
│       │   ├── mipmap-hdpi/
│       │   ├── mipmap-xhdpi/
│       │   ├── mipmap-xxhdpi/
│       │   └── mipmap-xxxhdpi/
│       ├── icon_ios/             # Ícones processados iOS
│       │   └── AppIcon.appiconset/
│       └── splash.png            # Splash screen
├── credentials/
│   └── {app_id}/
│       ├── ios/
│       │   └── {uuid}.enc        # Certificate + provisioning criptografados
│       └── android/
│           └── {uuid}.enc        # Keystore criptografado
├── builds/
│   └── {app_id}/
│       └── {version_code}/
│           ├── app-release.apk
│           ├── app-release.aab
│           └── Runner.ipa
└── logs/
    └── {build_job_id}.log
```

### 0.2 Variáveis de ambiente

```env
# ============================================================================
# STORAGE (Cloudflare R2)
# ============================================================================
S3_BUCKET=appfy-builds
S3_REGION=auto
S3_ENDPOINT=https://{account_id}.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx

# ============================================================================
# ENCRYPTION
# ============================================================================
# Gerar com: openssl rand -hex 32
CREDENTIALS_ENCRYPTION_KEY=<64-char-hex>

# ============================================================================
# ONESIGNAL
# ============================================================================
ONESIGNAL_API_KEY=xxx           # REST API Key da organização
ONESIGNAL_ORG_ID=xxx            # Organization ID

# ============================================================================
# BUILD SERVICE (escolher um)
# ============================================================================
# Opção A: Codemagic
CODEMAGIC_API_TOKEN=xxx
CODEMAGIC_APP_ID=xxx

# Opção B: GitHub Actions
GITHUB_TOKEN=xxx
GITHUB_REPO=owner/repo

# ============================================================================
# WEBHOOK
# ============================================================================
BUILD_WEBHOOK_SECRET=xxx        # Para validar callbacks
```

### 0.3 Atualizar schema Prisma

```prisma
model App {
  id                  String   @id @default(uuid()) @db.Uuid
  store_id            String   @db.Uuid
  name                String
  bundle_id_ios       String?
  bundle_id_android   String?
  status              String   @default("draft")

  // NOVO: OneSignal
  onesignal_app_id    String?
  onesignal_api_key   String?  // Criptografada

  // NOVO: Remote Config Keypair
  rc_public_key       String?  // Ed25519 public key (base64)
  rc_private_key_ref  String?  // Referência ao secret no S3

  // NOVO: Assets
  icon_url            String?  // URL do ícone no S3
  splash_url          String?  // URL do splash no S3

  config              Json     @default("{}")
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  store       Store          @relation(...)
  versions    AppVersion[]
  credentials AppCredential[]

  @@unique([store_id])
  @@map("apps")
}
```

---

## Fase 1: Storage Service

### 1.1 Arquivos

```
apps/api/src/common/storage/
├── storage.module.ts
├── storage.service.ts
└── storage.types.ts
```

### 1.2 Implementação

```typescript
// storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow('S3_BUCKET');
    this.s3 = new S3Client({
      region: config.get('S3_REGION', 'auto'),
      endpoint: config.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
    return `s3://${this.bucket}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    return Buffer.from(await response.Body!.transformToByteArray());
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}
```

### 1.3 Dependências

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Fase 2: Apps Module

### 2.1 Arquivos

```
apps/api/src/modules/apps/
├── apps.module.ts
├── apps.controller.ts
├── apps.service.ts
├── keypair.service.ts          # Geração de Ed25519 keypairs
└── dto/
    ├── update-app.dto.ts
    └── index.ts
```

### 2.2 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/apps` | Retorna o app da store (1 por store) |
| `PUT` | `/apps/:id` | Atualiza nome, bundle IDs |
| `POST` | `/apps/:id/generate-keypair` | Gera novo par de chaves RC |
| `GET` | `/apps/:id/versions` | Lista versões buildadas |

### 2.3 Keypair Service (Ed25519)

```typescript
// keypair.service.ts
import { Injectable } from '@nestjs/common';
import { generateKeyPairSync, createSign, createVerify } from 'crypto';
import { StorageService } from '../../common/storage/storage.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

@Injectable()
export class KeypairService {
  constructor(
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
  ) {}

  async generateKeypair(appId: string): Promise<{ publicKey: string }> {
    // Gerar par de chaves Ed25519
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });

    // Criptografar private key
    const encryptedPrivateKey = this.encryption.encrypt(privateKey);

    // Upload para S3
    const privateKeyRef = `keypairs/${appId}/private.enc`;
    await this.storage.upload(
      privateKeyRef,
      Buffer.concat([
        encryptedPrivateKey.iv,
        encryptedPrivateKey.tag,
        encryptedPrivateKey.encrypted,
      ]),
    );

    // Retornar public key em base64
    return {
      publicKey: publicKey.toString('base64'),
      privateKeyRef,
    };
  }

  async signConfig(appId: string, configJson: string): Promise<string> {
    // Baixar e descriptografar private key
    const privateKeyData = await this.storage.download(`keypairs/${appId}/private.enc`);
    const iv = privateKeyData.subarray(0, 16);
    const tag = privateKeyData.subarray(16, 32);
    const encrypted = privateKeyData.subarray(32);

    const privateKey = this.encryption.decrypt(encrypted, iv, tag);

    // Assinar
    const sign = createSign('SHA256');
    sign.update(configJson);
    return sign.sign({ key: privateKey, format: 'der', type: 'pkcs8' }, 'base64');
  }
}
```

### 2.4 DTO

```typescript
// update-app.dto.ts
import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, {
    message: 'Bundle ID must be in reverse domain format (e.g., com.example.app)',
  })
  bundle_id_ios?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, {
    message: 'Package name must be in reverse domain format (e.g., com.example.app)',
  })
  bundle_id_android?: string;
}
```

---

## Fase 3: Assets Module

### 3.1 Arquivos

```
apps/api/src/modules/assets/
├── assets.module.ts
├── assets.controller.ts
├── assets.service.ts
└── image-processor.service.ts
```

### 3.2 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/apps/:appId/assets/icon` | Upload do ícone (1024x1024 PNG) |
| `POST` | `/apps/:appId/assets/splash` | Upload do splash screen |
| `GET` | `/apps/:appId/assets` | Retorna URLs dos assets |
| `DELETE` | `/apps/:appId/assets/:type` | Remove asset |

### 3.3 Image Processor

O ícone precisa ser redimensionado para múltiplas resoluções:

```typescript
// image-processor.service.ts
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

interface IconSize {
  name: string;
  size: number;
}

const ANDROID_ICON_SIZES: IconSize[] = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

const IOS_ICON_SIZES: IconSize[] = [
  { name: '20@2x', size: 40 },
  { name: '20@3x', size: 60 },
  { name: '29@2x', size: 58 },
  { name: '29@3x', size: 87 },
  { name: '40@2x', size: 80 },
  { name: '40@3x', size: 120 },
  { name: '60@2x', size: 120 },
  { name: '60@3x', size: 180 },
  { name: '76', size: 76 },
  { name: '76@2x', size: 152 },
  { name: '83.5@2x', size: 167 },
  { name: '1024', size: 1024 },
];

@Injectable()
export class ImageProcessorService {
  async processAppIcon(iconBuffer: Buffer): Promise<{
    android: Map<string, Buffer>;
    ios: Map<string, Buffer>;
  }> {
    const android = new Map<string, Buffer>();
    const ios = new Map<string, Buffer>();

    // Processar para Android
    for (const { name, size } of ANDROID_ICON_SIZES) {
      const resized = await sharp(iconBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      android.set(`${name}/ic_launcher.png`, resized);
    }

    // Processar para iOS
    for (const { name, size } of IOS_ICON_SIZES) {
      const resized = await sharp(iconBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      ios.set(`AppIcon${name}.png`, resized);
    }

    return { android, ios };
  }

  async validateIcon(buffer: Buffer): Promise<void> {
    const metadata = await sharp(buffer).metadata();

    if (metadata.format !== 'png') {
      throw new Error('Icon must be PNG format');
    }

    if (metadata.width !== 1024 || metadata.height !== 1024) {
      throw new Error('Icon must be 1024x1024 pixels');
    }
  }
}
```

### 3.4 Assets Controller

```typescript
// assets.controller.ts
@Controller('apps/:appId/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  @Post('icon')
  @UseInterceptors(FileInterceptor('file'))
  async uploadIcon(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    // 1. Validar que é PNG 1024x1024
    await this.imageProcessor.validateIcon(file.buffer);

    // 2. Processar para todas as resoluções
    const { android, ios } = await this.imageProcessor.processAppIcon(file.buffer);

    // 3. Upload original
    await this.storage.upload(
      `assets/${appId}/icon.png`,
      file.buffer,
      'image/png',
    );

    // 4. Upload versões Android
    for (const [path, buffer] of android) {
      await this.storage.upload(
        `assets/${appId}/icon_android/${path}`,
        buffer,
        'image/png',
      );
    }

    // 5. Upload versões iOS
    for (const [path, buffer] of ios) {
      await this.storage.upload(
        `assets/${appId}/icon_ios/${path}`,
        buffer,
        'image/png',
      );
    }

    // 6. Atualizar App.icon_url
    await this.appsService.updateIconUrl(appId, `assets/${appId}/icon.png`);

    return { success: true };
  }
}
```

### 3.5 Dependências

```bash
pnpm add sharp
pnpm add -D @types/multer
```

---

## Fase 4: OneSignal Integration

### 4.1 Decisão de Arquitetura

**Opção A: Um OneSignal App por store (Recomendado)**
- Isolamento completo de dados
- Analytics separados
- Custo: $0 até 10k subscribers por app

**Opção B: Um OneSignal App compartilhado com tags**
- Mais simples de gerenciar
- Usa tags para segmentar por store
- Menos isolamento

**Escolha: Opção A** - Criar um OneSignal app para cada store.

### 4.2 Fluxo de criação

```
1. Store é criada
2. App é criado automaticamente
3. Usuário clica "Setup Push Notifications"
4. Sistema cria OneSignal App via API:
   POST https://api.onesignal.com/apps
   {
     "name": "Store Name - Mobile App",
     "organization_id": "{ONESIGNAL_ORG_ID}",
     "apns_env": "production",
     "apns_p12": "...",           // Se já tiver credentials iOS
     "gcm_key": "..."             // Firebase Cloud Messaging key
   }
5. Salva onesignal_app_id e api_key (criptografada) no App
6. Usuário precisa completar config no OneSignal dashboard:
   - iOS: Upload APNs certificate
   - Android: Firebase config
```

### 4.3 OneSignal Service

```typescript
// onesignal.service.ts
@Injectable()
export class OneSignalService {
  private readonly apiUrl = 'https://api.onesignal.com';

  constructor(
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  async createApp(storeName: string): Promise<{ appId: string; apiKey: string }> {
    const response = await fetch(`${this.apiUrl}/apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.config.get('ONESIGNAL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${storeName} - Mobile App`,
        organization_id: this.config.get('ONESIGNAL_ORG_ID'),
      }),
    });

    const data = await response.json();

    return {
      appId: data.id,
      apiKey: data.basic_auth_key,
    };
  }

  async deleteApp(appId: string): Promise<void> {
    await fetch(`${this.apiUrl}/apps/${appId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${this.config.get('ONESIGNAL_API_KEY')}`,
      },
    });
  }
}
```

### 4.4 Alternativa: Setup manual

Se preferir não criar apps automaticamente via API:

1. Usuário cria OneSignal App manualmente no dashboard
2. Copia o App ID e API Key
3. Cola no Console do AppFy
4. Sistema valida e salva

---

## Fase 5: Credentials Module

### 5.1 Arquivos

```
apps/api/src/modules/credentials/
├── credentials.module.ts
├── credentials.controller.ts
├── credentials.service.ts
├── validators/
│   ├── ios-certificate.validator.ts
│   └── android-keystore.validator.ts
└── dto/
    ├── upload-ios.dto.ts
    ├── upload-android.dto.ts
    └── index.ts
```

### 5.2 Encryption Service (Comum)

```
apps/api/src/common/encryption/
├── encryption.module.ts
└── encryption.service.ts
```

```typescript
// encryption.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const keyHex = config.getOrThrow<string>('CREDENTIALS_ENCRYPTION_KEY');
    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== 32) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
    }
  }

  encrypt(data: Buffer): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return { encrypted, iv, tag };
  }

  decrypt(encrypted: Buffer, iv: Buffer, tag: Buffer): Buffer {
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }
}
```

### 5.3 iOS Certificate Validator

```typescript
// ios-certificate.validator.ts
import { Injectable } from '@nestjs/common';
import forge from 'node-forge';

interface P12Info {
  commonName: string;
  teamId: string;
  expiresAt: Date;
  serialNumber: string;
}

@Injectable()
export class IosCertificateValidator {
  validateP12(p12Buffer: Buffer, password: string): P12Info {
    try {
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extrair certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;

      if (!cert) {
        throw new Error('No certificate found in P12');
      }

      // Extrair informações
      const commonName = cert.subject.getField('CN')?.value || '';
      const teamId = this.extractTeamId(cert);
      const expiresAt = cert.validity.notAfter;
      const serialNumber = cert.serialNumber;

      // Validar expiração
      if (expiresAt < new Date()) {
        throw new Error('Certificate has expired');
      }

      return { commonName, teamId, expiresAt, serialNumber };
    } catch (error) {
      if (error.message.includes('Invalid password')) {
        throw new Error('Invalid certificate password');
      }
      throw error;
    }
  }

  private extractTeamId(cert: forge.pki.Certificate): string {
    // Team ID está no OU do subject
    const ou = cert.subject.getField('OU');
    return ou?.value || '';
  }
}
```

### 5.4 Endpoints

```typescript
// credentials.controller.ts
@Controller('apps/:appId/credentials')
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  @Get()
  async list(@Param('appId') appId: string) {
    // Retorna lista de credentials (sem dados sensíveis)
    return this.credentialsService.list(appId);
  }

  @Post('ios')
  async uploadIos(
    @Param('appId') appId: string,
    @Body() dto: UploadIosCredentialDto,
  ) {
    // 1. Decodificar base64
    const p12Buffer = Buffer.from(dto.certificate_p12, 'base64');
    const provisioningBuffer = Buffer.from(dto.provisioning_profile, 'base64');

    // 2. Validar P12
    const certInfo = this.iosValidator.validateP12(p12Buffer, dto.password);

    // 3. Validar provisioning profile
    const provisioningInfo = this.iosValidator.validateProvisioning(provisioningBuffer);

    // 4. Verificar match de team_id
    if (certInfo.teamId !== provisioningInfo.teamId) {
      throw new BadRequestException('Certificate and provisioning profile team IDs do not match');
    }

    // 5. Criptografar e salvar
    const credentialId = await this.credentialsService.saveIosCredential(
      appId,
      {
        p12: p12Buffer,
        password: dto.password,
        provisioning: provisioningBuffer,
      },
      {
        teamId: certInfo.teamId,
        bundleId: provisioningInfo.bundleId,
        expiresAt: certInfo.expiresAt,
        commonName: certInfo.commonName,
      },
    );

    return {
      id: credentialId,
      platform: 'ios',
      metadata: {
        team_id: certInfo.teamId,
        bundle_id: provisioningInfo.bundleId,
        expires_at: certInfo.expiresAt,
        common_name: certInfo.commonName,
      },
    };
  }

  @Post('android')
  async uploadAndroid(
    @Param('appId') appId: string,
    @Body() dto: UploadAndroidCredentialDto,
  ) {
    // Similar ao iOS, mas valida keystore
  }

  @Delete(':credentialId')
  async delete(
    @Param('appId') appId: string,
    @Param('credentialId') credentialId: string,
  ) {
    await this.credentialsService.delete(appId, credentialId);
    return { success: true };
  }
}
```

### 5.5 Dependências

```bash
pnpm add node-forge
pnpm add -D @types/node-forge
```

---

## Fase 6: Builds Module

### 6.1 Arquivos

```
apps/api/src/modules/builds/
├── builds.module.ts
├── builds.controller.ts
├── builds.service.ts
├── codemagic.service.ts        # ou github-actions.service.ts
└── dto/
    └── create-build.dto.ts

apps/api/src/workers/processors/
└── build.processor.ts
```

### 6.2 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/apps/:appId/builds` | Inicia novo build |
| `GET` | `/apps/:appId/builds` | Lista builds |
| `GET` | `/apps/:appId/builds/:id` | Status do build |
| `GET` | `/apps/:appId/builds/:id/logs` | Logs do build |
| `DELETE` | `/apps/:appId/builds/:id` | Cancela build |
| `GET` | `/apps/:appId/builds/:id/download` | URL de download do artifact |
| `POST` | `/webhooks/builds/:id/status` | Callback do build service |

### 6.3 Create Build DTO

```typescript
export class CreateBuildDto {
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  version_name: string;  // "1.2.3"

  @IsOptional()
  @IsString()
  release_notes?: string;
}
```

### 6.4 Build Service

```typescript
// builds.service.ts
@Injectable()
export class BuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buildQueue: InjectQueue(QUEUE_NAMES.BUILD),
    private readonly codemagic: CodemagicService,
  ) {}

  async create(appId: string, dto: CreateBuildDto, userId: string) {
    // 1. Validar app e permissões
    const app = await this.validateAppAndPermissions(appId, userId);

    // 2. Validar que tem credentials para a plataforma
    await this.validateCredentials(appId, dto.platform);

    // 3. Validar que não há build em andamento
    await this.validateNoBuildInProgress(appId, dto.platform);

    // 4. Calcular version_code (auto-increment)
    const versionCode = await this.getNextVersionCode(appId, dto.platform);

    // 5. Criar AppVersion
    const appVersion = await this.prisma.appVersion.create({
      data: {
        app_id: appId,
        platform: dto.platform,
        version_name: dto.version_name,
        version_code: versionCode,
        status: 'pending',
      },
    });

    // 6. Criar BuildJob
    const buildJob = await this.prisma.buildJob.create({
      data: {
        app_version_id: appVersion.id,
        status: 'pending',
      },
    });

    // 7. Enfileirar job
    await this.buildQueue.add('process-build', {
      buildJobId: buildJob.id,
      appId,
      appVersionId: appVersion.id,
      platform: dto.platform,
      versionName: dto.version_name,
      versionCode,
    });

    return {
      build_id: buildJob.id,
      version: {
        id: appVersion.id,
        name: dto.version_name,
        code: versionCode,
      },
      status: 'queued',
    };
  }

  async getDownloadUrl(appId: string, buildId: string): Promise<string> {
    const buildJob = await this.prisma.buildJob.findUnique({
      where: { id: buildId },
      include: { app_version: true },
    });

    if (!buildJob?.app_version?.artifact_url) {
      throw new NotFoundException('Artifact not found');
    }

    // Gerar signed URL (expira em 1 hora)
    return this.storage.getSignedUrl(buildJob.app_version.artifact_url, 3600);
  }
}
```

### 6.5 Build Processor

```typescript
// build.processor.ts
@Processor(QUEUE_NAMES.BUILD)
export class BuildProcessor extends WorkerHost {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    private readonly codemagic: CodemagicService,
  ) {
    super();
  }

  async process(job: Job<BuildJobData>): Promise<void> {
    const { buildJobId, appId, platform, versionName, versionCode } = job.data;

    this.logger.log(`Processing build ${buildJobId} for app ${appId}`);

    try {
      // 1. Atualizar status para 'running'
      await this.updateStatus(buildJobId, 'running');

      // 2. Buscar app com todas as informações necessárias
      const app = await this.getAppWithDetails(appId);

      // 3. Baixar credentials
      const credentials = await this.downloadCredentials(appId, platform);

      // 4. Baixar assets (ícones)
      const assets = await this.downloadAssets(appId);

      // 5. Preparar configuração do build
      const buildConfig = this.prepareBuildConfig({
        app,
        platform,
        versionName,
        versionCode,
        credentials,
        assets,
      });

      // 6. Trigger build no Codemagic
      const externalBuildId = await this.codemagic.triggerBuild(buildConfig);

      // 7. Salvar ID externo
      await this.prisma.buildJob.update({
        where: { id: buildJobId },
        data: { external_build_id: externalBuildId },
      });

      // 8. Monitorar até completar (polling ou webhook)
      // Se usando webhook, o status será atualizado pelo endpoint /webhooks/builds/:id/status

      this.logger.log(`Build ${buildJobId} triggered successfully: ${externalBuildId}`);

    } catch (error) {
      this.logger.error(`Build ${buildJobId} failed: ${error.message}`);

      await this.updateStatus(buildJobId, 'failed', error.message);

      throw error;
    }
  }

  private prepareBuildConfig(data: BuildConfigData): CodemagicBuildConfig {
    const { app, platform, versionName, versionCode, credentials, assets } = data;

    return {
      workflowId: platform === 'ios' ? 'ios-release' : 'android-release',
      branch: 'main',
      environment: {
        // Variáveis para dart-define
        APP_ID: app.id,
        STORE_ID: app.store_id,
        API_BASE_URL: process.env.API_BASE_URL,
        PRIMARY_DOMAIN: app.store.primary_domain,
        ONESIGNAL_APP_ID: app.onesignal_app_id || '',
        RC_PUBLIC_KEY: app.rc_public_key || '',
        VERSION_NAME: versionName,
        VERSION_CODE: String(versionCode),

        // Bundle IDs
        BUNDLE_ID: platform === 'ios' ? app.bundle_id_ios : app.bundle_id_android,

        // Credentials (base64)
        ...(platform === 'ios' ? {
          IOS_CERTIFICATE_P12: credentials.p12.toString('base64'),
          IOS_CERTIFICATE_PASSWORD: credentials.password,
          IOS_PROVISIONING_PROFILE: credentials.provisioning.toString('base64'),
        } : {
          ANDROID_KEYSTORE: credentials.keystore.toString('base64'),
          ANDROID_KEYSTORE_PASSWORD: credentials.keystorePassword,
          ANDROID_KEY_ALIAS: credentials.keyAlias,
          ANDROID_KEY_PASSWORD: credentials.keyPassword,
        }),
      },
      // Assets são copiados pelo workflow do Codemagic
      artifacts: {
        icon: assets.icon,
        splash: assets.splash,
      },
    };
  }
}
```

### 6.6 Webhook para status updates

```typescript
// builds.controller.ts
@Post('webhooks/builds/:buildJobId/status')
async handleBuildWebhook(
  @Param('buildJobId') buildJobId: string,
  @Body() body: BuildWebhookPayload,
  @Headers('x-signature') signature: string,
) {
  // 1. Validar assinatura do webhook
  this.validateWebhookSignature(body, signature);

  // 2. Atualizar status
  if (body.status === 'finished') {
    // 3. Download artifact do Codemagic
    const artifactUrl = await this.codemagic.getArtifactUrl(body.buildId);
    const artifactBuffer = await this.downloadArtifact(artifactUrl);

    // 4. Upload para nosso S3
    const s3Key = `builds/${body.appId}/${body.versionCode}/${body.platform === 'ios' ? 'app.ipa' : 'app.apk'}`;
    await this.storage.upload(s3Key, artifactBuffer);

    // 5. Atualizar AppVersion com artifact_url
    await this.prisma.appVersion.update({
      where: { id: body.appVersionId },
      data: {
        status: 'built',
        artifact_url: s3Key,
      },
    });

    // 6. Atualizar BuildJob
    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: {
        status: 'completed',
        completed_at: new Date(),
      },
    });
  } else if (body.status === 'failed') {
    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: {
        status: 'failed',
        error_message: body.error,
        completed_at: new Date(),
      },
    });
  }

  return { received: true };
}
```

---

## Fase 7: UI do Console

### 7.1 Estrutura de páginas

```
apps/console/src/app/(dashboard)/stores/[storeId]/app-builder/
├── page.tsx                    # Config (tema, módulos) - JÁ EXISTE
├── settings/
│   └── page.tsx                # Nome, bundle IDs, OneSignal
├── assets/
│   └── page.tsx                # Upload ícone e splash
├── credentials/
│   └── page.tsx                # Upload certificados
└── builds/
    ├── page.tsx                # Lista de builds
    └── [buildId]/
        └── page.tsx            # Detalhes e logs
```

### 7.2 Navegação no sidebar

```typescript
// Adicionar ao layout.tsx
const APP_BUILDER_NAV = [
  { name: 'Configuration', href: `/stores/${storeId}/app-builder`, icon: Palette },
  { name: 'Settings', href: `/stores/${storeId}/app-builder/settings`, icon: Settings },
  { name: 'Assets', href: `/stores/${storeId}/app-builder/assets`, icon: Image },
  { name: 'Credentials', href: `/stores/${storeId}/app-builder/credentials`, icon: Key },
  { name: 'Builds', href: `/stores/${storeId}/app-builder/builds`, icon: Rocket },
];
```

### 7.3 Tela de Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  App Builder > Settings                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APP INFORMATION                                                 │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  App Name                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Minha Loja                                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  BUNDLE IDENTIFIERS                                              │
│  ────────────────────────────────────────────────────────────── │
│  ⚠️ Cannot be changed after first build                         │
│                                                                  │
│  iOS Bundle ID                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ com.minhaloja.app                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Android Package Name                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ com.minhaloja.app                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  PUSH NOTIFICATIONS                                              │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ OneSignal Connected                                      ││
│  │ App ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx                ││
│  │                                           [Disconnect]      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ou                                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ❌ Push Notifications not configured                        ││
│  │                                                              ││
│  │ [Setup Automatically]  [Enter Manually]                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  REMOTE CONFIG KEYS                                              │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Public Key: MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcD...             ││
│  │ Generated: Jan 15, 2026                                     ││
│  │                                           [Regenerate]      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│                                               [Save Changes]     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Tela de Assets

```
┌─────────────────────────────────────────────────────────────────┐
│  App Builder > Assets                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APP ICON                                                        │
│  ────────────────────────────────────────────────────────────── │
│  Required: 1024x1024 PNG, no transparency                        │
│                                                                  │
│  ┌───────────────────┐                                          │
│  │                   │                                          │
│  │    [App Icon      │    ✅ Uploaded                           │
│  │     Preview]      │    Last updated: Jan 20, 2026            │
│  │                   │                                          │
│  │                   │    [Replace Icon]                        │
│  └───────────────────┘                                          │
│                                                                  │
│  ou                                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │  ┌─────────────────────────────────────────┐                ││
│  │  │                                         │                ││
│  │  │     📁 Drop icon here or click          │                ││
│  │  │        to upload                        │                ││
│  │  │                                         │                ││
│  │  └─────────────────────────────────────────┘                ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  SPLASH SCREEN (Optional)                                        │
│  ────────────────────────────────────────────────────────────── │
│  Recommended: 2732x2732 PNG                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │     ❌ No splash screen uploaded                            ││
│  │                                                              ││
│  │     [Upload Splash Screen]                                  ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Tela de Credentials

```
┌─────────────────────────────────────────────────────────────────┐
│  App Builder > Credentials                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐   │
│  │          iOS              │  │        Android            │   │
│  ├───────────────────────────┤  ├───────────────────────────┤   │
│  │                           │  │                           │   │
│  │  Distribution Certificate │  │  Upload Keystore          │   │
│  │  ┌─────────────────────┐  │  │  ┌─────────────────────┐  │   │
│  │  │ ✅ Configured       │  │  │  │ ✅ Configured       │  │   │
│  │  │                     │  │  │  │                     │  │   │
│  │  │ Team: ABCD123456    │  │  │  │ Alias: upload-key   │  │   │
│  │  │ Name: iPhone Dist.  │  │  │  │ Valid until: 2050   │  │   │
│  │  │ Expires: Dec 2025   │  │  │  │                     │  │   │
│  │  │                     │  │  │  │ [Replace]           │  │   │
│  │  │ [Replace]           │  │  │  └─────────────────────┘  │   │
│  │  └─────────────────────┘  │  │                           │   │
│  │                           │  │                           │   │
│  │  Provisioning Profile     │  │                           │   │
│  │  ┌─────────────────────┐  │  │                           │   │
│  │  │ ✅ Configured       │  │  │                           │   │
│  │  │                     │  │  │                           │   │
│  │  │ Type: App Store     │  │  │                           │   │
│  │  │ Bundle: com.app.id  │  │  │                           │   │
│  │  │ Expires: Dec 2025   │  │  │                           │   │
│  │  │                     │  │  │                           │   │
│  │  │ [Replace]           │  │  │                           │   │
│  │  └─────────────────────┘  │  │                           │   │
│  │                           │  │                           │   │
│  └───────────────────────────┘  └───────────────────────────┘   │
│                                                                  │
│  ℹ️ Credentials are encrypted and stored securely.               │
│     We never have access to your passwords in plain text.        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.6 Tela de Builds

```
┌─────────────────────────────────────────────────────────────────┐
│  App Builder > Builds                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [+ New Build ▼]                                                 │
│  ┌────────────────┐                                              │
│  │ 🍎 iOS         │                                              │
│  │ 🤖 Android     │                                              │
│  │ 📦 Both        │                                              │
│  └────────────────┘                                              │
│                                                                  │
│  RECENT BUILDS                                                   │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📱 v1.2.0 (build 5)                                        ││
│  │  🤖 Android                              ✅ Completed       ││
│  │  Completed 2 hours ago                                      ││
│  │                                                              ││
│  │  [Download APK]  [Download AAB]  [View Logs]                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📱 v1.2.0 (build 4)                                        ││
│  │  🍎 iOS                                  🔄 Building        ││
│  │  Started 15 minutes ago                                     ││
│  │                                                              ││
│  │  ████████████░░░░░░░░ 60%                                   ││
│  │  Installing dependencies...                                  ││
│  │                                                              ││
│  │  [View Logs]  [Cancel]                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📱 v1.1.0 (build 3)                                        ││
│  │  🍎 iOS                                  ❌ Failed          ││
│  │  Failed 1 day ago                                           ││
│  │                                                              ││
│  │  Error: Code signing failed - certificate expired           ││
│  │                                                              ││
│  │  [View Logs]  [Retry]                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo Completo End-to-End

### Primeiro setup de um app

```
1. USUÁRIO CRIA STORE
   └── Sistema cria App automaticamente (já implementado)

2. USUÁRIO ACESSA APP BUILDER > SETTINGS
   ├── Define nome do app
   ├── Define bundle IDs (iOS e Android)
   └── Sistema gera Remote Config keypair

3. USUÁRIO CONFIGURA ONESIGNAL
   ├── Opção A: Sistema cria OneSignal app automaticamente
   └── Opção B: Usuário insere App ID manualmente

4. USUÁRIO ACESSA APP BUILDER > ASSETS
   ├── Upload do ícone (1024x1024 PNG)
   ├── Sistema processa para todas as resoluções
   └── (Opcional) Upload do splash screen

5. USUÁRIO ACESSA APP BUILDER > CONFIGURATION (já existe)
   ├── Configura tema (cores, fontes)
   ├── Configura módulos (home, cart, etc.)
   ├── Configura allowlist
   └── Publica configuração

6. USUÁRIO ACESSA APP BUILDER > CREDENTIALS
   ├── iOS: Upload .p12 + provisioning profile
   └── Android: Upload keystore

7. USUÁRIO ACESSA APP BUILDER > BUILDS
   ├── Seleciona plataforma (iOS, Android ou ambos)
   ├── Define versão (1.0.0)
   └── Clica "Build"

8. SISTEMA PROCESSA BUILD
   ├── Valida todas as configurações
   ├── Cria AppVersion e BuildJob
   ├── Enfileira job
   └── Worker processa:
       ├── Baixa assets e credentials
       ├── Prepara projeto Flutter
       ├── Executa flutter build
       └── Upload artifact

9. USUÁRIO FAZ DOWNLOAD
   ├── APK para sideload/Play Store
   ├── AAB para Play Store
   └── IPA para App Store Connect
```

### Builds subsequentes

```
1. (Opcional) Atualiza configuração no App Builder
2. (Opcional) Atualiza assets
3. Vai para Builds
4. Seleciona plataforma
5. Define nova versão
6. Build
7. Download
```

---

## Resumo de Arquivos

### Backend (25 arquivos)

```
apps/api/src/
├── common/
│   ├── storage/
│   │   ├── storage.module.ts
│   │   ├── storage.service.ts
│   │   └── storage.types.ts
│   └── encryption/
│       ├── encryption.module.ts
│       └── encryption.service.ts
├── modules/
│   ├── apps/
│   │   ├── apps.module.ts
│   │   ├── apps.controller.ts
│   │   ├── apps.service.ts
│   │   ├── keypair.service.ts
│   │   └── dto/index.ts
│   ├── assets/
│   │   ├── assets.module.ts
│   │   ├── assets.controller.ts
│   │   ├── assets.service.ts
│   │   ├── image-processor.service.ts
│   │   └── dto/index.ts
│   ├── credentials/
│   │   ├── credentials.module.ts
│   │   ├── credentials.controller.ts
│   │   ├── credentials.service.ts
│   │   ├── validators/ios.validator.ts
│   │   ├── validators/android.validator.ts
│   │   └── dto/index.ts
│   └── builds/
│       ├── builds.module.ts
│       ├── builds.controller.ts
│       ├── builds.service.ts
│       ├── codemagic.service.ts
│       └── dto/index.ts
└── workers/processors/
    └── build.processor.ts
```

### Frontend (8 páginas)

```
apps/console/src/app/(dashboard)/stores/[storeId]/app-builder/
├── page.tsx                    # JÁ EXISTE
├── settings/page.tsx           # NOVO
├── assets/page.tsx             # NOVO
├── credentials/page.tsx        # NOVO
└── builds/
    ├── page.tsx                # NOVO
    └── [buildId]/page.tsx      # NOVO
```

### API Client additions

```typescript
// api-client.ts - adicionar:
appsApi
assetsApi
credentialsApi
buildsApi
```

---

## Estimativas

| Fase | Componente | Tempo | LOC |
|------|------------|-------|-----|
| 0 | Infraestrutura (S3, env vars, Prisma) | 0.5d | ~50 |
| 1 | Storage Service | 0.5d | ~150 |
| 2 | Apps Module + Keypair | 1d | ~400 |
| 3 | Assets Module + Image Processing | 1.5d | ~500 |
| 4 | OneSignal Integration | 0.5d | ~150 |
| 5 | Credentials Module | 2d | ~600 |
| 6 | Builds Module + Worker | 2d | ~700 |
| 7 | UI do Console (5 páginas) | 3d | ~1500 |
| - | Testes e ajustes | 1d | - |
| **Total** | | **~12 dias** | **~4050** |

---

## Checklist de Setup Externo

- [ ] Criar conta Cloudflare R2 e bucket
- [ ] Criar conta Codemagic e configurar projeto
- [ ] Criar organização no OneSignal
- [ ] Gerar CREDENTIALS_ENCRYPTION_KEY
- [ ] Configurar variáveis de ambiente no Railway
- [ ] Configurar webhook URL no Codemagic
