import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { MailService } from '../../mail/mail.service';
import { CreateWarrantyDto } from './dto/create-warranty.dto';
import { WARRANTY_REMINDER_QUEUE, type WarrantyReminderJobPayload } from './warranty-reminder.job';

const DEFAULT_WARRANTY_MONTHS = 12;

@Injectable()
export class WarrantyService {
  private readonly logger = new Logger(WarrantyService.name);

  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly cloudinary: CloudinaryService,
    private readonly mail: MailService,
    @Optional()
    @InjectQueue(WARRANTY_REMINDER_QUEUE)
    private readonly reminderQueue: Queue<WarrantyReminderJobPayload> | null,
  ) {}

  async register(
    customerId: string,
    dto: CreateWarrantyDto,
    invoiceBuffer?: Buffer,
    locale = 'en',
  ) {
    const brandId = this.tenantContext.getTenant();

    const purchaseDate = new Date(dto.purchaseDate);
    const warrantyExpiresAt = new Date(purchaseDate);
    warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + DEFAULT_WARRANTY_MONTHS);

    let invoiceImageUrl: string | undefined;
    let invoicePublicId: string | undefined;

    if (invoiceBuffer) {
      const id = `${customerId}-${Date.now()}`;
      const result = await this.cloudinary.uploadPrivate(invoiceBuffer, brandId, 'warranty', id);
      invoiceImageUrl = result.secureUrl;
      invoicePublicId = result.publicId;
    }

    const warranty = await this.tenantDb.warrantyRegistration.create({
      data: {
        customerId,
        productSku: dto.productSku,
        serialNumber: dto.serialNumber,
        purchaseDate,
        platform: dto.platform,
        shopOrderId: dto.shopOrderId,
        invoiceImageUrl,
        invoicePublicId,
        warrantyExpiresAt,
        status: 'active',
      },
    });

    const customer = await this.tenantDb.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (customer) {
      void this.mail
        .sendWarrantyConfirmation(customer.email, locale, brandId, {
          productSku: dto.productSku,
          serialNumber: dto.serialNumber,
          purchaseDate: purchaseDate.toLocaleDateString(),
          warrantyExpiresAt: warrantyExpiresAt.toLocaleDateString(),
        })
        .catch((err: unknown) =>
          this.logger.warn(`Warranty confirmation email failed: ${String(err)}`),
        );

      if (this.reminderQueue) {
        const delay = warrantyExpiresAt.getTime() - Date.now() - 30 * 24 * 3600 * 1000;
        const jobDelay = Math.max(0, delay);

        await this.reminderQueue.add(
          'send-reminder',
          {
            warrantyId: warranty.id,
            customerId,
            email: customer.email,
            locale,
            brandId,
            productSku: dto.productSku,
            warrantyExpiresAt: warrantyExpiresAt.toLocaleDateString(),
          },
          { delay: jobDelay },
        );
      }
    }

    return {
      id: warranty.id,
      productSku: warranty.productSku,
      serialNumber: warranty.serialNumber,
      warrantyExpiresAt: warrantyExpiresAt.toISOString(),
      status: warranty.status,
    };
  }

  async listByCustomer(customerId: string) {
    const rows = await this.tenantDb.warrantyRegistration.findMany({
      where: { customerId },
      orderBy: { registeredAt: 'desc' },
      select: {
        id: true,
        productSku: true,
        serialNumber: true,
        purchaseDate: true,
        platform: true,
        warrantyExpiresAt: true,
        status: true,
        registeredAt: true,
      },
    });
    return rows;
  }

  async findOne(warrantyId: string, customerId: string) {
    const warranty = await this.tenantDb.warrantyRegistration.findUnique({
      where: { id: warrantyId },
    });

    if (!warranty) {
      throw new NotFoundException(`Warranty ${warrantyId} not found`);
    }
    if (warranty.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    return warranty;
  }
}
