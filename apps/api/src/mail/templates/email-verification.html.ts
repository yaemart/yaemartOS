export interface EmailVerificationParams {
  brandName: string;
  logoUrl: string;
  verificationUrl: string;
  locale: string;
}

export function emailVerificationTemplate(params: EmailVerificationParams): string {
  const { brandName, logoUrl, verificationUrl } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:48px;max-width:200px;object-fit:contain;margin-bottom:16px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brandName} — 验证您的邮箱</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
              ${logoHtml}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${brandName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">验证您的邮箱地址</h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                感谢您注册 ${brandName}！请点击下方按钮完成邮箱验证，以激活您的账户。
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:6px;background:#1a1a1a;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">
                      验证邮箱
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.5;">
                如果按钮无法点击，请复制以下链接到浏览器：
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${verificationUrl}" style="color:#1a1a1a;font-size:13px;">${verificationUrl}</a>
              </p>
              <p style="margin:0;padding:16px;background:#fff8e1;border-radius:4px;color:#7a6000;font-size:13px;line-height:1.5;">
                ⏰ 此验证链接将在 <strong>24 小时</strong>后失效。如已过期，请重新申请验证邮件。
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:12px;line-height:1.5;">
                如果您未曾注册 ${brandName} 账户，请忽略此邮件。<br/>
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
