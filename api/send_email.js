/**
 * Reusable email sender via Resend API
 * Uses the same Resend account configured in other iNova apps (Hostinger VPS)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.RESEND_FROM_EMAIL || 'AuditFlow <noreply@ianovatechsystems.com>';
const APP_URL        = process.env.APP_URL || 'https://muestreo.ianovatechsystems.com';

/**
 * Send a welcome email to a newly created user with their temporary credentials.
 * @param {object} opts
 * @param {string} opts.to        - recipient email
 * @param {string} opts.fullName  - recipient full name
 * @param {string} opts.role      - Auditor | Supervisor | Admin
 * @param {string} opts.password  - temporary password (plain text — sent once)
 * @param {string} opts.createdBy - name of the admin who created the account
 */
export async function sendWelcomeEmail({ to, fullName, role, password, createdBy }) {
    if (!RESEND_API_KEY) {
        console.warn('[send_email] RESEND_API_KEY not set — skipping email');
        return { skipped: true };
    }

    const loginUrl = APP_URL;
    const firstName = fullName.split(' ')[0];

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bienvenido a AuditFlow</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:48px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo header -->
        <tr><td style="text-align:center;padding-bottom:32px;">
          <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#4f46e5);border-radius:16px;line-height:52px;text-align:center;margin-bottom:12px;">
            <span style="font-size:24px;">⬡</span>
          </div>
          <div style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">AuditFlow Enterprise v3.0</div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">

          <!-- Top accent bar -->
          <tr><td style="background:linear-gradient(90deg,#3b82f6,#4f46e5);height:4px;"></td></tr>

          <tr><td style="padding:40px 40px 0;">
            <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">
              Tu acceso ha sido creado
            </p>
            <h1 style="margin:0 0 24px;color:#f8fafc;font-size:26px;font-weight:900;line-height:1.2;">
              Bienvenido, ${firstName} 👋
            </h1>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
              <strong style="color:#cbd5e1;">${createdBy}</strong> ha creado tu cuenta en la plataforma de auditoría estadística AuditFlow con el rol de <strong style="color:#60a5fa;">${role}</strong>.
            </p>
          </td></tr>

          <!-- Credentials box -->
          <tr><td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid rgba(59,130,246,0.2);border-radius:16px;padding:24px;margin-bottom:24px;">
              <tr>
                <td style="padding-bottom:16px;">
                  <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:6px;">Correo electrónico</div>
                  <div style="color:#f8fafc;font-size:15px;font-weight:600;">${to}</div>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
                  <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:6px;">Contraseña temporal</div>
                  <div style="display:inline-block;background:#1e293b;border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:10px 16px;font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#60a5fa;letter-spacing:0.1em;">${password}</div>
                  <div style="margin-top:8px;color:#f59e0b;font-size:11px;font-weight:600;">
                    ⚠️ Deberás cambiar esta contraseña en tu primer inicio de sesión
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- CTA Button -->
          <tr><td style="padding:0 40px 32px;text-align:center;">
            <a href="${loginUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#4f46e5);color:#ffffff;text-decoration:none;font-weight:900;font-size:14px;letter-spacing:0.05em;padding:16px 36px;border-radius:14px;box-shadow:0 8px 24px rgba(59,130,246,0.35);">
              Ingresar al Sistema →
            </a>
            <div style="margin-top:12px;color:#475569;font-size:11px;">
              o copia este enlace: <span style="color:#60a5fa;">${loginUrl}</span>
            </div>
          </td></tr>

          <!-- Steps -->
          <tr><td style="padding:0 40px 32px;">
            <div style="background:#0f172a;border-radius:14px;padding:20px;">
              <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px;">Cómo empezar</div>
              ${[
                ['1', 'Haz clic en "Ingresar al Sistema"', '#3b82f6'],
                ['2', 'Ingresa tu correo y la contraseña temporal', '#8b5cf6'],
                ['3', 'Establece tu nueva contraseña personal', '#10b981'],
              ].map(([n, txt, color]) => `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <div style="width:24px;height:24px;background:${color};border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">${n}</div>
                <div style="color:#94a3b8;font-size:13px;">${txt}</div>
              </div>`).join('')}
            </div>
          </td></tr>

          <!-- Security note -->
          <tr><td style="padding:0 40px 32px;">
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px 16px;">
              <div style="color:#f59e0b;font-size:12px;font-weight:700;">🔒 Aviso de seguridad</div>
              <div style="color:#92400e;font-size:11px;margin-top:4px;line-height:1.5;">
                Nunca compartas esta contraseña. Si no solicitaste este acceso, ignora este correo y contáctanos.
              </div>
            </div>
          </td></tr>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <div style="color:#334155;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;">
            © 2026 iNova Tech Systems · AuditFlow Enterprise
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: [to],
            subject: `Bienvenido a AuditFlow — Tu acceso ha sido creado`,
            html,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Resend error ${response.status}: ${err.message || JSON.stringify(err)}`);
    }

    const data = await response.json();
    console.log(`[send_email] Welcome email sent to ${to} — id: ${data.id}`);
    return data;
}
