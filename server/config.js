'use strict';
/* =============================================================
   Configuración del servidor.
   Lee las variables de entorno del proceso y del archivo .env
   (sin dependencias externas: se parsea el .env a mano).
   ============================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  raw.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  });
}

loadEnvFile(path.join(ROOT, '.env'));

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

const config = {
  root: ROOT,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',

  publicDir: path.join(ROOT, 'public'),
  dataFile: process.env.DATA_FILE
    ? path.resolve(ROOT, process.env.DATA_FILE)
    : path.join(ROOT, 'data', 'citas.json'),

  /* Correo al que llega cada cita */
  shopEmail: (process.env.SHOP_EMAIL || 'miguelmelladoros6@gmail.com').trim(),
  /* Copia de confirmación al cliente (true/false) */
  mailClientCopy: bool(process.env.MAIL_CLIENT_COPY, true),

  /* URL pública del sitio (se usa como Referer en los envíos por FormSubmit).
     Netlify ya publica la variable URL con la dirección del sitio. */
  siteUrl: (process.env.PUBLIC_URL || process.env.URL || '').trim(),

  /* Envío de correo: smtp | formsubmit | off (auto = smtp y, si falla, formsubmit) */
  mailMode: (process.env.MAIL_MODE || 'auto').toLowerCase(),
  mailFrom: (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim(),

  smtp: {
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim()
  },

  /* Token de acceso al panel de gestión de citas (/admin) */
  adminToken: (process.env.ADMIN_TOKEN || 'mayka-2026').trim(),

  /* Número de peluqueras en servicio simultáneo (Mayka y Sara) */
  capacity: Number(process.env.CAPACITY || 2),

  /* Zona horaria de referencia del negocio */
  timezone: process.env.TZ || 'Europe/Madrid',

  /* Paso de la rejilla de horas, en minutos */
  slotStep: Number(process.env.SLOT_STEP || 30),

  /* Días hacia adelante que se pueden reservar */
  horizonDays: Number(process.env.HORIZON_DAYS || 60)
};

module.exports = config;
