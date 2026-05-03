export interface WarrantyExpiryReminderParams {
  brandName: string;
  logoUrl: string;
  locale: string;
  productSku: string;
  warrantyExpiresAt: string;
  renewUrl: string;
}

const i18n = {
  en: {
    subject: 'Your warranty expires soon',
    heading: 'Your warranty expires in 30 days',
    body: (p: WarrantyExpiryReminderParams) =>
      `Your <strong>${p.productSku}</strong> warranty with ${p.brandName} will expire on <strong>${p.warrantyExpiresAt}</strong>. Please contact us if you need assistance.`,
    ctaLabel: 'Contact Support',
    footer: (brandName: string) =>
      `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`,
  },
  es: {
    subject: 'Tu garantía vence pronto',
    heading: 'Tu garantía vence en 30 días',
    body: (p: WarrantyExpiryReminderParams) =>
      `La garantía de tu <strong>${p.productSku}</strong> con ${p.brandName} vencerá el <strong>${p.warrantyExpiresAt}</strong>. Contáctanos si necesitas ayuda.`,
    ctaLabel: 'Contactar soporte',
    footer: (brandName: string) =>
      `© ${new Date().getFullYear()} ${brandName}. Todos los derechos reservados.`,
  },
  fr: {
    subject: 'Votre garantie expire bientôt',
    heading: 'Votre garantie expire dans 30 jours',
    body: (p: WarrantyExpiryReminderParams) =>
      `La garantie de votre <strong>${p.productSku}</strong> avec ${p.brandName} expirera le <strong>${p.warrantyExpiresAt}</strong>. Contactez-nous si vous avez besoin d'aide.`,
    ctaLabel: 'Contacter le support',
    footer: (brandName: string) =>
      `© ${new Date().getFullYear()} ${brandName}. Tous droits réservés.`,
  },
} as const;

type SupportedLocale = keyof typeof i18n;

export function warrantyExpiryReminderTemplate(params: WarrantyExpiryReminderParams): string {
  const locale: SupportedLocale =
    (params.locale as SupportedLocale) in i18n ? (params.locale as SupportedLocale) : 'en';
  const t = i18n[locale];
  const { brandName, logoUrl } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:48px;max-width:200px;object-fit:contain;margin-bottom:16px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brandName} — ${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
              ${logoHtml}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <div style="padding:12px 16px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin-bottom:24px;">
                <p style="margin:0;color:#856404;font-size:14px;font-weight:600;">⏰ ${t.heading}</p>
              </div>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">${t.body(params)}</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:6px;background:#1a1a1a;">
                    <a href="${params.renewUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">
                      ${t.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:12px;line-height:1.5;">${t.footer(brandName)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
