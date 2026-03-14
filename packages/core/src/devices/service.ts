import type { CreateAppUserInput } from '../app-users/repository.js'
import type { AppUserRepository } from '../app-users/repository.js'
import { DeviceNotFoundError } from '../errors.js'
import type { DeviceRepository, DeviceRow, RegisterDeviceInput } from './repository.js'

export interface DeviceServiceDeps {
  deviceRepo: DeviceRepository
  appUserRepo: AppUserRepository
}

export class DeviceService {
  private readonly deviceRepo: DeviceRepository
  private readonly appUserRepo: AppUserRepository

  constructor(deps: DeviceServiceDeps | DeviceRepository) {
    if ('deviceRepo' in deps) {
      this.deviceRepo = deps.deviceRepo
      this.appUserRepo = deps.appUserRepo
    } else {
      // Backward compat: single repo passed directly
      this.deviceRepo = deps
      this.appUserRepo = undefined as never
    }
  }

  /**
   * Registers a device for an app user.
   * - If appUser doesn't exist, creates the user first (atomically).
   * - Token rotation: new token for same user+platform deactivates old devices.
   */
  async register(
    tenantId: string,
    input: RegisterDeviceInput,
    appUserInput?: CreateAppUserInput,
  ): Promise<DeviceRow> {
    // Ensure app user exists
    if (this.appUserRepo) {
      const existingUser = await this.appUserRepo.findById(tenantId, input.appUserId)
      if (!existingUser && appUserInput) {
        await this.appUserRepo.create(tenantId, appUserInput)
      }
    }

    // Token rotation: deactivate old devices for same user+platform
    if (input.deviceToken) {
      await this.deviceRepo.deactivateByUserAndPlatform(tenantId, input.appUserId, input.platform)
    }

    return this.deviceRepo.register(tenantId, input)
  }

  async findActiveByUser(tenantId: string, appUserId: string): Promise<DeviceRow[]> {
    return this.deviceRepo.findActiveByUser(tenantId, appUserId)
  }

  async deactivate(tenantId: string, id: string): Promise<void> {
    const device = await this.deviceRepo.findById(tenantId, id)
    if (!device) {
      throw new DeviceNotFoundError(id)
    }
    return this.deviceRepo.deactivate(tenantId, id)
  }
}
