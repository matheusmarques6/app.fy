import { DeviceNotFoundError } from '../errors.js'
import type { DeviceRepository, DeviceRow, RegisterDeviceInput } from './repository.js'

export class DeviceService {
  constructor(private readonly deviceRepo: DeviceRepository) {}

  async register(tenantId: string, input: RegisterDeviceInput): Promise<DeviceRow> {
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
