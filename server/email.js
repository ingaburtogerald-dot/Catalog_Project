// Utilidad de correo — invitaciones a usuarios locales y Google.
// Requiere EMAIL_USER y EMAIL_PASS en .env (App Password de Gmail).
const nodemailer = require('nodemailer');
const config = require('./config');

const ROLE_NAMES = {
  admin: 'Administrador', seller: 'Vendedor', cashier: 'Cajero',
  global_admin: 'Administrador Global', logistics_admin: 'Admin. Gyro Logistics', logistics_customer: 'Cliente Gyro Logistics',
};

const LOGISTICS_STATUS_COPY = {
  recibido_china: {
    subject: 'Tu paquete fue recibido en nuestra bodega en China',
    title: '📦 ¡Paquete recibido en China!',
    body: 'Tu paquete fue confirmado en nuestra bodega en China. El tiempo estimado de llegada a Managua es de <strong>45 a 60 días</strong>.',
  },
  recibido_nicaragua: {
    subject: 'Tu paquete llegó a Nicaragua',
    title: '🇳🇮 ¡Tu paquete llegó a Nicaragua!',
    body: 'Tu paquete ya se encuentra en Nicaragua. Nos pondremos en contacto para coordinar la entrega/retiro en Managua.',
  },
};

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

// Notifica a los admins de Gyro Logistics que un cliente agregó una nueva revisión de paquete.
async function sendLogisticsAdminAlert({ toEmails, customerName, shippingNumber, purchaseDate, photoUrl }) {
  if (!config.email.user || !toEmails?.length) return false;
  const from = config.email.from || `"Gyro Store" <${config.email.user}>`;

  await createTransport().sendMail({
    from, to: toEmails.join(','),
    subject: `Gyro Logistics — Nueva revisión de ${customerName}`,
    html: wrap(`
      ${header('📦 Nueva revisión de paquete')}
      <div style="padding:32px;">
        <p><strong>${customerName}</strong> agregó una nueva compra en Gyro Logistics:</p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#aab2cf;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Fecha de compra</p>
          <p style="margin:0 0 14px;font-weight:700;">${purchaseDate || '—'}</p>
          <p style="margin:0 0 6px;color:#aab2cf;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Número de envío</p>
          <p style="margin:0;font-weight:700;color:#7c83ff;">${shippingNumber || '—'}</p>
        </div>
        <p>Confirma con el equipo en China si fue recibido, y actualiza el estado desde el portal.</p>
        ${photoUrl ? btn(photoUrl, 'Ver foto del paquete') : ''}
      </div>
      ${footer()}
    `),
  });
  return true;
}

// Notifica al cliente que su paquete avanzó de estado (recibido en China / recibido en Nicaragua).
async function sendLogisticsStatusEmail({ to, customerName, status, comment }) {
  if (!config.email.user) return false;
  const copy = LOGISTICS_STATUS_COPY[status];
  if (!copy) return false;
  const from = config.email.from || `"Gyro Store" <${config.email.user}>`;

  await createTransport().sendMail({
    from, to,
    subject: `Gyro Logistics — ${copy.subject}`,
    html: wrap(`
      ${header(copy.title)}
      <div style="padding:32px;">
        <p>Hola <strong>${customerName}</strong>,</p>
        <p>${copy.body}</p>
        ${comment ? `
        <div style="background:#1e293b;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#aab2cf;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Comentario del equipo</p>
          <p style="margin:0;">${comment}</p>
        </div>` : ''}
        <p style="color:#717a9c;font-size:13px;">Puedes revisar el estado de tu paquete en cualquier momento desde Gyro Logistics.</p>
      </div>
      ${footer()}
    `),
  });
  return true;
}

module.exports = { sendLocalInvite, sendGuestInvite, sendLogisticsAdminAlert, sendLogisticsStatusEmail };
