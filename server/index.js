'use strict';
/* =============================================================
   Peluquería Mayka · Los Alcázares (Murcia)
   Servidor web con sistema de citas (Node puro, sin dependencias).

   La lógica de la API vive en server/app.js, compartida con la
   Netlify Function (netlify/functions/api.js).
   ============================================================= */
const http = require('http');
const config = require('./config');
const { handle } = require('./app');
const store = require('./store');
const mailer = require('./mailer');

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[error]', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ ok: false, error: 'Error interno del servidor.' }));
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  El puerto ${config.port} ya está ocupado por otro proceso.`);
    console.error('  Opciones:');
    console.error(`    · Cierra el otro servidor:  taskkill /PID <pid> /F`);
    console.error(`    · Usa otro puerto:         set PORT=3001 && node server/index.js`);
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(config.port, config.host, () => {
  const modoCorreo = config.mailMode === 'off'
    ? 'desactivado'
    : mailer.smtpDisponible()
      ? 'SMTP (' + config.smtp.host + ')'
      : 'FormSubmit.co (sin SMTP configurado)';

  console.log('');
  console.log('  Peluquería Mayka · Los Alcázares');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Sitio:    http://localhost:${config.port}`);
  console.log(`  Panel:    http://localhost:${config.port}/admin?token=${config.adminToken}`);
  console.log(`  Correo:   ${config.shopEmail}`);
  console.log(`  Envío:    ${modoCorreo}`);
  console.log(`  Citas:    ${store.modo() === 'blobs' ? 'Netlify Blobs' : 'archivo ' + config.dataFile}`);
  console.log(`  Capacidad:${config.capacity} cita(s) simultánea(s) · TZ ${config.timezone}`);
  console.log('  ─────────────────────────────────────────────');
  console.log('');
});
