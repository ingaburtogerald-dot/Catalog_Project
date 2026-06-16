// Utilidad de correo — invitaciones a usuarios locales y Google.
// Requiere EMAIL_USER y EMAIL_PASS en .env (App Password de Gmail).
const nodemailer = require('nodemailer');
const config = require('./config');

const ROLE_NAMES = { admin: 'Administrador', seller: 'Vendedor', cashier: 'Cajero' };

function createTransport() {
  return nodemailer.createTransport({
    host:   config.email.host,
    port:   config.email.port,
    secure: config.email.secure,
    auth:   { user: config.email.user, pass: config.email.pass },
    connectionTimeout: 10000, // 10 segundos
    greetingTimeout: 10000,
    socketTimeout: 15000,
    family: 4, // Forzar IPv4 para evitar problemas con IPv6 en Render
  });
}

const header = (title) => `
  <div style="background:linear-gradient(135deg,#7c83ff,#9aa0ff);padding:32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">${title}</h1>
  </div>`;

const footer = () => `
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <p style="margin:0;color:#717a9c;font-size:12px;">Gyro Store · Sistema Interno</p>
  </div>`;

const btn = (href, text) => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c83ff,#9aa0ff);color:#fff;text-decoration:none;border-radius:99px;font-weight:700;font-size:15px;">${text} →</a>
  </div>`;

const wrap = (inner) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0b0f19;color:#e2e8f0;border-radius:12px;overflow:hidden;">
    ${inner}
  </div>`;

async function sendLocalInvite({ to, displayName, email, role, resetLink }) {
  if (!config.email.user) return false;
  const roleName = ROLE_NAMES[role] || role;
  const from = config.email.from || `"Gyro Store" <${config.email.user}>`;

  await createTransport().sendMail({
    from, to,
    subject: 'Bienvenido a Gyro Store — Activa tu cuenta',
    html: wrap(`
      ${header('¡Bienvenido a Gyro Store!')}
      <div style="padding:32px;">
        <p>Hola <strong>${displayName}</strong>,</p>
        <p>Has sido agregado al sistema como <strong>${roleName}</strong>.</p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#aab2cf;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tu correo de acceso</p>
          <p style="margin:0;font-weight:700;color:#7c83ff;">${email}</p>
        </div>
        <p>Haz clic para crear tu contraseña y activar tu cuenta:</p>
        ${btn(resetLink, 'Activar mi cuenta')}
        <p style="color:#717a9c;font-size:13px;">Este enlace expira en 24 horas.</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

async function sendGuestInvite({ to, displayName, role, appUrl }) {
  if (!config.email.user) return false;
  const roleName = ROLE_NAMES[role] || role;
  const from = config.email.from || `"Gyro Store" <${config.email.user}>`;

  await createTransport().sendMail({
    from, to,
    subject: 'Invitación para colaborar en Gyro Store',
    html: wrap(`
      ${header('¡Has sido invitado!')}
      <div style="padding:32px;">
        <p>Hola <strong>${displayName}</strong>,</p>
        <p>Has sido invitado a colaborar en <strong>Gyro Store</strong> como <strong>${roleName}</strong>.</p>
        <p>Inicia sesión con tu cuenta de Google (<strong>${to}</strong>):</p>
        ${btn(appUrl, 'Acceder a Gyro Store')}
        <p style="color:#717a9c;font-size:13px;">Usa únicamente la cuenta de Google asociada a <strong>${to}</strong>.</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

module.exports = { sendLocalInvite, sendGuestInvite };
