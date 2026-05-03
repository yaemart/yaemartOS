export interface PasswordResetParams {
  brandName: string;
  logoUrl: string;
  resetUrl: string;
  locale: string;
}

export function passwordResetTemplate(params: PasswordResetParams): string {
  const { brandName, logoUrl, resetUrl } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:48px;max-width:200px;object-fit:contain;margin-bottom:16px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brandName} — 密码重置请求</title>
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
              <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">重置您的密码</h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                我们收到了您的密码重置请求。请点击下方按钮设置新密码。如果这不是您的操作，请忽略此邮件，您的账户依然安全。
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:6px;background:#c0392b;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">
                      重置密码
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.5;">
                如果按钮无法点击，请复制以下链接到浏览器：
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${resetUrl}" style="color:#1a1a1a;font-size:13px;">${resetUrl}</a>
              </p>
              <p style="margin:0;padding:16px;background:#fdecea;border-radius:4px;color:#8b1a1a;font-size:13px;line-height:1.5;">
                ⏰ 此重置链接将在 <strong>1 小时</strong>后失效。如已过期，请重新发起密码重置请求。
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:12px;line-height:1.5;">
                如果您未发起密码重置请求，请忽略此邮件，您的账户不会受到任何影响。<br/>
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
