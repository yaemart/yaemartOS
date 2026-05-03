export interface WarrantyConfirmationParams {
  brandName: string;
  logoUrl: string;
  locale: string;
  productSku: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyExpiresAt: string;
}

const i18n = {
  en: {
    subject: 'Warranty Registered',
    heading: 'Your warranty is registered!',
    body: (p: WarrantyConfirmationParams) =>
      `Thank you for registering your <strong>${p.productSku}</strong> warranty with ${p.brandName}. Your purchase is protected.`,
    serialLabel: 'Serial Number',
    purchaseLabel: 'Purchase Date',
    expiresLabel: 'Warranty Expires',
    footer: (brandName: string) =>
      `If you did not register a product with ${brandName}, please ignore this email.`,
  },
  es: {
    subject: 'Garantía registrada',
    heading: '¡Tu garantía ha sido registrada!',
    body: (p: WarrantyConfirmationParams) =>
      `Gracias por registrar la garantía de tu <strong>${p.productSku}</strong> con ${p.brandName}. Tu compra está protegida.`,
    serialLabel: 'Número de serie',
    purchaseLabel: 'Fecha de compra',
    expiresLabel: 'Garantía válida hasta',
    footer: (brandName: string) =>
      `Si no registraste un producto con ${brandName}, ignora este correo.`,
  },
  fr: {
    subject: 'Garantie enregistrée',
    heading: 'Votre garantie est enregistrée !',
    body: (p: WarrantyConfirmationParams) =>
      `Merci d'avoir enregistré votre garantie pour <strong>${p.productSku}</strong> avec ${p.brandName}. Votre achat est protégé.`,
    serialLabel: 'Numéro de série',
    purchaseLabel: "Date d'achat",
    expiresLabel: 'Garantie expire le',
    footer: (brandName: string) =>
      `Si vous n'avez pas enregistré de produit chez ${brandName}, ignorez cet e-mail.`,
  },
} as const;

type SupportedLocale = keyof typeof i18n;

export function warrantyConfirmationTemplate(params: WarrantyConfirmationParams): string {
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
              <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">${t.heading}</h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">${t.body(params)}</p>
              <table cellpadding="8" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr style="background:#f9fafb;">
                  <td style="color:#6b7280;font-size:13px;padding:10px 16px;font-weight:600;">${t.serialLabel}</td>
                  <td style="color:#1a1a1a;font-size:13px;padding:10px 16px;">${params.serialNumber}</td>
                </tr>
                <tr>
                  <td style="color:#6b7280;font-size:13px;padding:10px 16px;font-weight:600;">${t.purchaseLabel}</td>
                  <td style="color:#1a1a1a;font-size:13px;padding:10px 16px;">${params.purchaseDate}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="color:#6b7280;font-size:13px;padding:10px 16px;font-weight:600;">${t.expiresLabel}</td>
                  <td style="color:#1a1a1a;font-size:13px;padding:10px 16px;font-weight:600;">${params.warrantyExpiresAt}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:12px;line-height:1.5;">
                ${t.footer(brandName)}<br/>
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
