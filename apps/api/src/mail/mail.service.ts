// nodemailer 未在 package.json 中，需先安装：
// pnpm add nodemailer @types/nodemailer --filter @yaemartos/api
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaClientManager } from '../database/prisma.service';
import { emailVerificationTemplate } from './templates/email-verification.html';
import { passwordResetTemplate } from './templates/password-reset.html';
import { warrantyConfirmationTemplate } from './templates/warranty-confirmation.html';
import { warrantyExpiryReminderTemplate } from './templates/warranty-expiry-reminder.html';

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly testMode: boolean;
  private readonly sentEmails: SentEmailRecord[] = [];
  private transporter: Transporter | null = null;

  constructor(private readonly prismaManager: PrismaClientManager) {
    this.testMode = process.env.MAIL_TEST_MODE === 'true';
    if (!this.testMode) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async sendVerification(
    to: string,
    token: string,
    brandId: string,
    locale: string,
  ): Promise<void> {
    const brandName = this.toBrandName(brandId);
    const [fromAddress, logoUrl] = await Promise.all([
      this.resolveFromAddress(brandId),
      this.resolveLogoUrl(brandId),
    ]);

    const portalBase = process.env.PORTAL_BASE_URL ?? 'http://localhost:3001';
    const verificationUrl = `${portalBase}/${locale}/verify-email?token=${token}`;
    const subject = `[${brandName}] 请验证您的邮箱`;

    const html = emailVerificationTemplate({ brandName, logoUrl, verificationUrl, locale });

    await this.dispatch({ from: fromAddress, to, subject, html });
  }

  async sendPasswordReset(
    to: string,
    token: string,
    brandId: string,
    locale: string,
  ): Promise<void> {
    const brandName = this.toBrandName(brandId);
    const [fromAddress, logoUrl] = await Promise.all([
      this.resolveFromAddress(brandId),
      this.resolveLogoUrl(brandId),
    ]);

    const portalBase = process.env.PORTAL_BASE_URL ?? 'http://localhost:3001';
    const resetUrl = `${portalBase}/${locale}/reset-password?token=${token}`;
    const subject = `[${brandName}] 密码重置请求`;

    const html = passwordResetTemplate({ brandName, logoUrl, resetUrl, locale });

    await this.dispatch({ from: fromAddress, to, subject, html });
  }

  async sendWarrantyConfirmation(
    to: string,
    locale: string,
    brandId: string,
    data: {
      productSku: string;
      serialNumber: string;
      purchaseDate: string;
      warrantyExpiresAt: string;
    },
  ): Promise<void> {
    const brandName = this.toBrandName(brandId);
    const [fromAddress, logoUrl] = await Promise.all([
      this.resolveFromAddress(brandId),
      this.resolveLogoUrl(brandId),
    ]);

    const subjectMap: Record<string, string> = {
      en: 'Warranty Registered',
      es: 'Garantía registrada',
      fr: 'Garantie enregistrée',
    };
    const subject = `[${brandName}] ${subjectMap[locale] ?? subjectMap['en']}`;
    const html = warrantyConfirmationTemplate({ brandName, logoUrl, locale, ...data });

    await this.dispatch({ from: fromAddress, to, subject, html });
  }

  async sendWarrantyExpiryReminder(
    to: string,
    locale: string,
    brandId: string,
    data: {
      productSku: string;
      warrantyExpiresAt: string;
      renewUrl: string;
    },
  ): Promise<void> {
    const brandName = this.toBrandName(brandId);
    const [fromAddress, logoUrl] = await Promise.all([
      this.resolveFromAddress(brandId),
      this.resolveLogoUrl(brandId),
    ]);

    const subjectMap: Record<string, string> = {
      en: 'Your warranty expires soon',
      es: 'Tu garantía vence pronto',
      fr: 'Votre garantie expire bientôt',
    };
    const subject = `[${brandName}] ${subjectMap[locale] ?? subjectMap['en']}`;
    const html = warrantyExpiryReminderTemplate({ brandName, logoUrl, locale, ...data });

    await this.dispatch({ from: fromAddress, to, subject, html });
  }

  getSentEmails(): ReadonlyArray<SentEmailRecord> {
    return this.sentEmails;
  }

  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }

  private async dispatch(mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (this.testMode) {
      this.sentEmails.push({ to: mail.to, subject: mail.subject, html: mail.html });
      this.logger.debug(`[TEST MODE] Mail captured — to=${mail.to} subject="${mail.subject}"`);
      return;
    }

    if (!this.transporter) {
      this.logger.warn('Mail transporter not initialised, skipping send.');
      return;
    }

    try {
      await this.transporter.sendMail(mail);
      this.logger.log(`Mail sent — to=${mail.to} subject="${mail.subject}"`);
    } catch (err) {
      this.logger.error(`Failed to send mail to ${mail.to}: ${String(err)}`);
      throw err;
    }
  }

  private async resolveFromAddress(brandId: string): Promise<string> {
    const fallback = process.env.MAIL_FROM_DEFAULT ?? 'noreply@yaemartos.com';
    try {
      const record = await this.prismaManager
        .getPublicClient()
        .systemConfig.findUnique({ where: { key: `mail.from.${brandId}` } });
      return record?.value ?? fallback;
    } catch {
      return fallback;
    }
  }

  private async resolveLogoUrl(brandId: string): Promise<string> {
    try {
      const record = await this.prismaManager
        .getPublicClient()
        .systemConfig.findUnique({ where: { key: `brand.logo_url.${brandId}` } });
      return record?.value ?? '';
    } catch {
      return '';
    }
  }

  private toBrandName(brandId: string): string {
    return brandId.charAt(0).toUpperCase() + brandId.slice(1);
  }
}
