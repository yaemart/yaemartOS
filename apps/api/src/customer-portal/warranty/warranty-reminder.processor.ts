import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaClientManager } from '../../database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { WARRANTY_REMINDER_QUEUE, type WarrantyReminderJobPayload } from './warranty-reminder.job';

@Processor(WARRANTY_REMINDER_QUEUE)
export class WarrantyReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(WarrantyReminderProcessor.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly mail: MailService,
  ) {
    super();
  }

  async process(job: Job<WarrantyReminderJobPayload>): Promise<void> {
    const { warrantyId, email, locale, brandId, productSku, warrantyExpiresAt } = job.data;

    const tenantDb = this.prismaManager.getTenantClient(brandId);
    const warranty = await tenantDb.warrantyRegistration.findUnique({
      where: { id: warrantyId },
      select: { reminderSentAt: true, status: true },
    });

    if (!warranty) {
      this.logger.warn(`Warranty ${warrantyId} not found, skipping reminder`);
      return;
    }

    if (warranty.reminderSentAt) {
      this.logger.log(`Reminder already sent for warranty ${warrantyId}, skipping`);
      return;
    }

    if (warranty.status !== 'active') {
      this.logger.log(`Warranty ${warrantyId} status=${warranty.status}, skipping reminder`);
      return;
    }

    const portalBase = process.env.PORTAL_BASE_URL ?? 'http://localhost:3001';
    const renewUrl = `${portalBase}/${locale}/tickets/new`;

    await this.mail.sendWarrantyExpiryReminder(email, locale, brandId, {
      productSku,
      warrantyExpiresAt,
      renewUrl,
    });

    await tenantDb.warrantyRegistration.update({
      where: { id: warrantyId },
      data: { reminderSentAt: new Date() },
    });

    this.logger.log(`Warranty expiry reminder sent for warranty=${warrantyId} email=${email}`);
  }
}
