import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { IosCertificateValidator } from './validators/ios-certificate.validator';
import { AndroidKeystoreValidator } from './validators/android-keystore.validator';
import { AppsModule } from '../apps/apps.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, AppsModule],
  controllers: [CredentialsController],
  providers: [
    CredentialsService,
    IosCertificateValidator,
    AndroidKeystoreValidator,
  ],
  exports: [CredentialsService],
})
export class CredentialsModule {}
