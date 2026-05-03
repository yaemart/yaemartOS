import type { TenantSchema } from '@yaemartos/db';

export const WARRANTY_REMINDER_QUEUE = 'warranty-reminder' as const;

export interface WarrantyReminderJobPayload {
  warrantyId: string;
  customerId: string;
  email: string;
  locale: string;
  brandId: TenantSchema;
  productSku: string;
  warrantyExpiresAt: string;
}
