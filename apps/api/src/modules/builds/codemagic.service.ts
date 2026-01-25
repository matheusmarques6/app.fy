import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CodemagicBuildConfig {
  appId: string;
  storeId: string;
  platform: 'ios' | 'android';
  versionName: string;
  versionCode: number;
  bundleId: string;
  appName: string;
  apiBaseUrl: string;
  primaryDomain: string;
  oneSignalAppId?: string;
  rcPublicKey?: string;
  iconUrl?: string;
  splashUrl?: string;
}

export interface CodemagicCredentials {
  // iOS
  certificate_p12?: string; // base64
  certificate_password?: string;
  provisioning_profile?: string; // base64
  // Android
  keystore?: string; // base64
  keystore_password?: string;
  key_alias?: string;
  key_password?: string;
}

export interface CodemagicBuildResponse {
  buildId: string;
  status: string;
}

export interface CodemagicBuildStatus {
  _id: string;
  status: 'queued' | 'preparing' | 'building' | 'publishing' | 'finished' | 'failed' | 'canceled';
  startedAt?: string;
  finishedAt?: string;
  artefacts?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

@Injectable()
export class CodemagicService {
  private readonly logger = new Logger(CodemagicService.name);
  private readonly apiUrl = 'https://api.codemagic.io';

  constructor(private readonly config: ConfigService) {}

  /**
   * Check if Codemagic is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.get<string>('CODEMAGIC_API_TOKEN') &&
      this.config.get<string>('CODEMAGIC_APP_ID')
    );
  }

  /**
   * Start a new build on Codemagic
   */
  async startBuild(
    buildConfig: CodemagicBuildConfig,
    credentials: CodemagicCredentials,
    webhookUrl: string,
  ): Promise<CodemagicBuildResponse> {
    const apiToken = this.config.get<string>('CODEMAGIC_API_TOKEN');
    const appId = this.config.get<string>('CODEMAGIC_APP_ID');

    if (!apiToken || !appId) {
      throw new Error('Codemagic is not configured');
    }

    const workflowId =
      buildConfig.platform === 'ios' ? 'ios-release' : 'android-release';

    // Prepare environment variables for the build
    const variables: Record<string, string> = {
      // App identification
      APPFY_APP_ID: buildConfig.appId,
      APPFY_STORE_ID: buildConfig.storeId,
      APPFY_BUILD_PLATFORM: buildConfig.platform,

      // App config
      APP_NAME: buildConfig.appName,
      BUNDLE_ID: buildConfig.bundleId,
      VERSION_NAME: buildConfig.versionName,
      VERSION_CODE: buildConfig.versionCode.toString(),

      // API config
      API_BASE_URL: buildConfig.apiBaseUrl,
      PRIMARY_DOMAIN: buildConfig.primaryDomain,

      // Webhook for completion notification
      APPFY_WEBHOOK_URL: webhookUrl,
    };

    // Optional configs
    if (buildConfig.oneSignalAppId) {
      variables.ONESIGNAL_APP_ID = buildConfig.oneSignalAppId;
    }
    if (buildConfig.rcPublicKey) {
      variables.RC_PUBLIC_KEY = buildConfig.rcPublicKey;
    }
    if (buildConfig.iconUrl) {
      variables.ICON_URL = buildConfig.iconUrl;
    }
    if (buildConfig.splashUrl) {
      variables.SPLASH_URL = buildConfig.splashUrl;
    }

    // Platform-specific credentials
    if (buildConfig.platform === 'ios') {
      if (credentials.certificate_p12) {
        variables.CM_CERTIFICATE = credentials.certificate_p12;
      }
      if (credentials.certificate_password) {
        variables.CM_CERTIFICATE_PASSWORD = credentials.certificate_password;
      }
      if (credentials.provisioning_profile) {
        variables.CM_PROVISIONING_PROFILE = credentials.provisioning_profile;
      }
    } else {
      if (credentials.keystore) {
        variables.CM_KEYSTORE = credentials.keystore;
      }
      if (credentials.keystore_password) {
        variables.CM_KEYSTORE_PASSWORD = credentials.keystore_password;
      }
      if (credentials.key_alias) {
        variables.CM_KEY_ALIAS = credentials.key_alias;
      }
      if (credentials.key_password) {
        variables.CM_KEY_PASSWORD = credentials.key_password;
      }
    }

    const payload = {
      appId,
      workflowId,
      branch: this.config.get<string>('CODEMAGIC_BRANCH', 'main'),
      environment: {
        variables,
        softwareVersions: {
          flutter: this.config.get<string>('CODEMAGIC_FLUTTER_VERSION', 'stable'),
        },
      },
    };

    this.logger.log(
      `Starting Codemagic build for ${buildConfig.bundleId} (${buildConfig.platform})`,
    );

    const response = await fetch(`${this.apiUrl}/builds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': apiToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Codemagic API error: ${response.status} - ${errorText}`);
      throw new Error(`Codemagic API error: ${response.status}`);
    }

    const result = (await response.json()) as { buildId: string };

    this.logger.log(`Codemagic build started: ${result.buildId}`);

    return {
      buildId: result.buildId,
      status: 'queued',
    };
  }

  /**
   * Get build status from Codemagic
   */
  async getBuildStatus(buildId: string): Promise<CodemagicBuildStatus> {
    const apiToken = this.config.get<string>('CODEMAGIC_API_TOKEN');

    if (!apiToken) {
      throw new Error('Codemagic is not configured');
    }

    const response = await fetch(`${this.apiUrl}/builds/${buildId}`, {
      method: 'GET',
      headers: {
        'x-auth-token': apiToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Codemagic API error: ${response.status}`);
    }

    return (await response.json()) as CodemagicBuildStatus;
  }

  /**
   * Cancel a running build
   */
  async cancelBuild(buildId: string): Promise<void> {
    const apiToken = this.config.get<string>('CODEMAGIC_API_TOKEN');

    if (!apiToken) {
      throw new Error('Codemagic is not configured');
    }

    const response = await fetch(`${this.apiUrl}/builds/${buildId}/cancel`, {
      method: 'POST',
      headers: {
        'x-auth-token': apiToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel build: ${response.status}`);
    }

    this.logger.log(`Codemagic build cancelled: ${buildId}`);
  }

  /**
   * Download artifact from Codemagic
   */
  async downloadArtifact(artifactUrl: string): Promise<Buffer> {
    const apiToken = this.config.get<string>('CODEMAGIC_API_TOKEN');

    if (!apiToken) {
      throw new Error('Codemagic is not configured');
    }

    const response = await fetch(artifactUrl, {
      method: 'GET',
      headers: {
        'x-auth-token': apiToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download artifact: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Verify webhook signature from Codemagic
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.config.get<string>('CODEMAGIC_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.warn('No webhook secret configured, skipping verification');
      return true;
    }

    // Codemagic uses HMAC-SHA256 for webhook signatures
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
