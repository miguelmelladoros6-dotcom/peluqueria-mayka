'use strict';
/* =============================================================
   Peluquería Mayka · Los Alcázares (Murcia)
   Manejador de la API, independiente de la plataforma.

   Sirve tanto para el servidor Node (server/index.js) como para
   Netlify Functions (netlify/functions/api.js): sólo necesita un
   objeto `req` con { method, url, headers, body? } y un objeto
   `res` con { writeHead, end, setHeader }.
   ============================================================= */
const path = require('path');
const { URL } = require('url');

const config = require('./config');
const store = require('./store');
const storage = require('./storage');
const revenue = require('./revenue');
const schedule = require('./schedule');
const mailer = require('./mailer');
const SERVICIOS = require('../public/shared/servicios');
const HORARIOS = require('../public/shared/horarios');

/* ---------- utilidades HTTP ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function texto(res, status, body, tipo) {
  res.writeHead(status, {
    'Content-Type': tipo || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

/** Lee el cuerpo de la petición tanto desde un stream como desde un objeto ya parseado. */
async function leerCuerpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      if (!req.body) return {};
      try {
        return JSON.parse(req.body);
      } catch (err) {
        throw new Error('JSON inválido');
      }
    }
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    let demasiadoGrande = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100000) {
        demasiadoGrande = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (demasiadoGrande) return reject(new Error('Cuerpo demasiado grande'));
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

/* ---------- validación de citas ---------- */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const RE_TEL = /^[+]?[\d\s().-]{9,20}$/;

function servicioPorId(id) {
  return SERVICIOS.find((s) => s.id === id) || null;
}

function validarCita(datos) {
  const errores = {};
  const nombre = String(datos.nombre || '').trim();
  const telefono = String(datos.telefono || '').trim();
  const email = String(datos.email || '').trim();
  const notas = String(datos.notas || '').trim();
  const servicio = servicioPorId(datos.servicio);
  const fecha = String(datos.fecha || '').trim();
  const hora = String(datos.hora || '').trim();

  if (nombre.length < 2 || nombre.length > 80) errores.nombre = 'Escribe tu nombre (mínimo 2 caracteres).';
  if (!RE_TEL.test(telefono)) errores.telefono = 'Introduce un teléfono válido (9 dígitos mínimo).';
  if (email && !RE_EMAIL.test(email)) errores.email = 'El correo no parece válido.';
  if (!servicio) errores.servicio = 'Elige un servicio.';
  if (!schedule.isValidDate(fecha)) errores.fecha = 'La fecha no es válida.';
  if (!/^\d{2}:\d{2}$/.test(hora)) errores.hora = 'Elige una hora.';
  if (notas.length > 600) errores.notas = 'Las notas son demasiado largas (máx. 600).';
  if (!datos.privacidad) errores.privacidad = 'Debes aceptar las condiciones de privacidad.';

  return {
    errores,
    valores: { nombre, telefono, email, notas, servicio, fecha, hora }
  };
}

/* ---------- token del panel ---------- */

/* Normaliza un token: ignora mayúsculas, espacios y separadores, y
   extrae el token si se ha pegado la URL completa del panel. */
function normalizarToken(valor) {
  let texto = String(valor == null ? '' : valor).trim();
  const deUrl = texto.match(/[?&]token=([^&#\s]+)/i);
  if (deUrl) {
    try {
      texto = decodeURIComponent(deUrl[1]);
    } catch (err) {
      texto = deUrl[1];
    }
  }
  return texto.replace(/[`'"]/g, '').replace(/[\s\-_.]+/g, '').toLowerCase();
}

function tokenValido(token) {
  const esperado = normalizarToken(config.adminToken);
  const recibido = normalizarToken(token);
  return Boolean(esperado) && esperado.length > 0 && esperado === recibido;
}

function adminAutorizado(url) {
  return tokenValido(url.searchParams.get('token'));
}

/* ---------- datos del negocio ---------- */

const DATOS_NEGOCIO = {
  nombre: 'Peluquería Mayka',
  direccion: 'Avenida Europa nº 5, Los Narejos',
  ciudad: '30710 Los Alcázares, Murcia',
  telefono: '+34868700105',
  telefonoLegible: '+34 868 70 01 05',
  email: config.shopEmail,
  valoracion: 4.8,
  numReseñas: 46,
  coordenadas: { lat: 37.76079, lng: -0.835474 }
};

/* ---------- endpoints ---------- */

async function apiDisponibilidad(url, res) {
  const fecha = (url.searchParams.get('fecha') || '').trim();
  const servicioId = (url.searchParams.get('servicio') || '').trim();
  const servicio = servicioPorId(servicioId);

  if (!schedule.isValidDate(fecha)) {
    return json(res, 400, { ok: false, error: 'Fecha no válida (AAAA-MM-DD).' });
  }
  if (!schedule.estaAbierto(fecha)) {
    return json(res, 200, {
      ok: true,
      fecha,
      abierto: false,
      mensaje: 'El salón está cerrado ese día.',
      slots: []
    });
  }

  const hoy = schedule.today(config.timezone);
  const limite = schedule.addDays(hoy, config.horizonDays);
  if (fecha < hoy || fecha > limite) {
    return json(res, 200, {
      ok: true,
      fecha,
      abierto: false,
      mensaje: 'Esa fecha está fuera del periodo de reserva.',
      slots: []
    });
  }

  const duracion = servicio ? servicio.duracion : 30;
  const slots = schedule.calcularSlots(fecha, duracion, await store.blocking(), {
    capacity: config.capacity,
    slotStep: config.slotStep,
    tz: config.timezone
  });

  return json(res, 200, {
    ok: true,
    fecha,
    abierto: true,
    servicio: servicio ? servicio.nombre : null,
    duracion,
    slots
  });
}

async function apiCrearCita(req, res) {
  let datos;
  try {
    datos = await leerCuerpo(req);
  } catch (err) {
    return json(res, 400, { ok: false, error: err.message });
  }

  const { errores, valores } = validarCita(datos);
  if (Object.keys(errores).length) {
    return json(res, 422, { ok: false, error: 'Revisa los datos del formulario.', errores });
  }

  if (!schedule.estaAbierto(valores.fecha)) {
    return json(res, 422, {
      ok: false,
      error: 'El salón está cerrado ese día.',
      errores: { fecha: 'El salón está cerrado ese día.' }
    });
  }
  const hoy = schedule.today(config.timezone);
  const limite = schedule.addDays(hoy, config.horizonDays);
  if (valores.fecha < hoy || valores.fecha > limite) {
    return json(res, 422, {
      ok: false,
      error: 'Fecha fuera del periodo de reserva.',
      errores: { fecha: 'Fecha fuera del periodo de reserva.' }
    });
  }

  /* Validación de bono regalo (si se aporta código) */
  const codigoBono = String(datos.bonoCodigo || datos.giftcardCode || '').trim();
  let bonoValido = null;
  if (codigoBono) {
    const v = await revenue.validarBono(codigoBono);
    if (!v.ok) {
      return json(res, 422, { ok: false, error: v.error, errores: { bono: v.error } });
    }
    bonoValido = v.bono;
  }

  /* Comprobación real de disponibilidad (evita dobles reservas) */
  const slots = schedule.calcularSlots(
    valores.fecha,
    valores.servicio.duracion,
    await store.blocking(),
    {
      capacity: config.capacity,
      slotStep: config.slotStep,
      tz: config.timezone
    }
  );
  const elegido = slots.find((s) => s.hora === valores.hora);
  if (!elegido) {
    return json(res, 422, {
      ok: false,
      error: 'Esa hora no existe en el horario del salón.',
      errores: { hora: 'Elige una hora disponible.' }
    });
  }
  if (!elegido.disponible) {
    return json(res, 409, {
      ok: false,
      error: 'Esa hora acaba de ocuparse. Elige otra.',
      errores: { hora: 'Esa hora ya no está disponible.' }
    });
  }

  const deposito = revenue.depositoPara({ servicio: valores.servicio.id });
  const cita = {
    nombre: valores.nombre,
    telefono: valores.telefono,
    email: valores.email,
    servicio: valores.servicio.id,
    servicioNombre: valores.servicio.nombre,
    duracion: valores.servicio.duracion,
    fecha: valores.fecha,
    hora: valores.hora,
    fin: elegido.fin,
    notas: valores.notas,
    origen: datos.origen || 'web',
    deposito: deposito,
    depositoPagado: false,
    bonoCodigo: bonoValido ? bonoValido.code : null,
    bonoImporte: 0,
    referralCode: String(datos.referralCode || '').trim() || null
  };

  const guardada = await store.add(cita);

  /* Canjeo de bono regalo si se aportó */
  if (bonoValido) {
    const precio = revenue.precioServicio(valores.servicio.id);
    const aCanjear = precio > 0 ? Math.min(precio, bonoValido.balance) : Math.min(10, bonoValido.balance);
    try {
      const r = await revenue.canjearBono(bonoValido.code, guardada.id, aCanjear);
      if (r.ok) {
        await store.update(guardada.id, { bonoImporte: r.importe, bonoSaldoRestante: r.saldoRestante });
        guardada.bonoImporte = r.importe;
      }
    } catch (err) { console.error('[bono]', err.message); }
  }

  /* Referido: si el cliente nuevo vino por un código, acreditar al padrino */
  if (cita.referralCode && valores.email) {
    try {
      await revenue.aplicarReferido(cita.referralCode, valores.email);
    } catch (err) { console.error('[referido]', err.message); }
  }

  let correo = { enviado: false, transporte: 'ninguno', error: null };
  try {
    correo = await mailer.enviarCita(guardada, valores.servicio);
  } catch (err) {
    correo = { enviado: false, transporte: 'error', error: err.message };
  }

  console.log(
    `[cita] ${guardada.id} · ${guardada.fecha} ${guardada.hora} · ${guardada.servicioNombre} · ${guardada.nombre} · correo:${correo.enviado ? correo.transporte : 'no enviado (' + (correo.error || 'sin config') + ')'}`
  );

  /* Se guarda el resultado del envío para poder revisarlo desde el panel */
  await store.update(guardada.id, {
    correoEnviado: correo.enviado,
    correoTransporte: correo.transporte,
    correoError: correo.error
  });

  return json(res, 201, {
    ok: true,
    cita: {
      id: guardada.id,
      nombre: guardada.nombre,
      telefono: guardada.telefono,
      email: guardada.email,
      servicio: guardada.servicioNombre,
      servicioId: guardada.servicio,
      duracion: guardada.duracion,
      fecha: guardada.fecha,
      fechaLegible: mailer.fechaLegible(guardada.fecha),
      hora: guardada.hora,
      fin: guardada.fin,
      notas: guardada.notas
    },
    deposito: guardada.deposito || 0,
    bonoImporte: guardada.bonoImporte || 0,
    correoEnviado: correo.enviado,
    correoTransporte: correo.transporte,
    correoError: correo.error
  });
}

async function apiAdminCitas(url, res) {
  if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token de acceso no válido.' });
  const citas = (await store.all()).reverse();
  return json(res, 200, { ok: true, citas });
}

async function apiAdminDiagnostico(url, res) {
  if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
  const citas = await store.all();
  const ultimas = citas.slice(-5).reverse();
  return json(res, 200, {
    ok: true,
    correo: {
      destinatario: config.shopEmail,
      modo: config.mailMode,
      smtpConfigurado: mailer.smtpDisponible(),
      transporte: mailer.smtpDisponible() ? 'smtp' : (config.mailMode === 'off' ? 'ninguno' : 'formsubmit'),
      copiaAlCliente: config.mailClientCopy
    },
    almacenamiento: store.modo(),
    capacidad: config.capacity,
    timezone: config.timezone,
    totalCitas: citas.length,
    ultimas: ultimas.map((c) => ({
      id: c.id,
      fecha: c.fecha,
      hora: c.hora,
      correoEnviado: c.correoEnviado,
      correoError: c.correoError
    }))
  });
}

async function apiAdminCambio(req, res, id) {
  let datos;
  try {
    datos = await leerCuerpo(req);
  } catch (err) {
    return json(res, 400, { ok: false, error: err.message });
  }
  if (!tokenValido(datos.token)) {
    return json(res, 401, { ok: false, error: 'Token de acceso no válido.' });
  }
  const permitidos = ['pendiente', 'confirmada', 'cancelada', 'realizada'];
  if (!permitidos.includes(datos.estado)) {
    return json(res, 400, { ok: false, error: 'Estado no válido.' });
  }
  const cita = await store.update(id, { estado: datos.estado });
  if (!cita) return json(res, 404, { ok: false, error: 'Cita no encontrada.' });

  const servicio = servicioPorId(cita.servicio);
  mailer.enviarCambioEstado(cita, servicio).catch(() => {});

  /* Si se cancela, notificar a la lista de espera para recuperar el hueco */
  if (datos.estado === 'cancelada') {
    revenue.notificarEsperaPorCancelacion(cita).catch(() => {});
  }

  return json(res, 200, { ok: true, cita });
}

function icsGenerar(citas) {
  const stamp = (fecha, hora) => {
    const d = new Date(`${fecha}T${hora}:00Z`);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peluqueria Mayka//Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  citas.forEach((c) => {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${c.id}@peluqueriamayka.es`,
      `DTSTAMP:${stamp(c.fecha, c.hora)}`,
      `DTSTART:${stamp(c.fecha, c.hora)}`,
      `DTEND:${stamp(c.fecha, c.fin || c.hora)}`,
      `SUMMARY:Cita - ${c.servicioNombre}`,
      `DESCRIPTION:Cliente: ${c.nombre}\\nTelefono: ${c.telefono}\\nRef: ${c.id}`,
      'LOCATION:Av. Europa 5, 30710 Los Alcazares (Murcia)',
      `STATUS:${c.estado === 'cancelada' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  });
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}

/* ---------- ficheros estáticos ---------- */

function servirArchivo(res, rutaAbsoluta, req) {
  const fs = require('fs');
  fs.stat(rutaAbsoluta, (err, stat) => {
    if (err || !stat.isFile()) {
      return texto(res, 404, 'No encontrado');
    }
    const ext = path.extname(rutaAbsoluta).toLowerCase();
    const etag = '"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';

    if (req && req.headers && req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      ETag: etag,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(rutaAbsoluta).pipe(res);
  });
}

function servirDesde(res, baseDir, rutaRelativa, req) {
  const limpio = decodeURIComponent(rutaRelativa).replace(/^\/+/, '');
  const destino = path.normalize(path.join(baseDir, limpio));
  if (!destino.startsWith(path.normalize(baseDir))) {
    return texto(res, 403, 'Acceso denegado');
  }
  servirArchivo(res, destino, req);
}

/* ---------- manejador principal ---------- */

async function handle(req, res) {
  const url = new URL(req.url, `http://${(req.headers && req.headers.host) || 'localhost'}`);
  const ruta = url.pathname;

  if (res.setHeader) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    /* -------- API -------- */
    if (ruta.startsWith('/api/')) {
      if (ruta === '/api/config' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          negocio: DATOS_NEGOCIO,
          servicios: SERVICIOS,
          horarios: HORARIOS,
          capacidad: config.capacity,
          timezone: config.timezone,
          hoy: schedule.today(config.timezone),
          horizonte: config.horizonDays,
          emailActivo: config.mailMode !== 'off',
          transporte: config.mailMode,
          revenue: {
            depositMode: config.depositMode,
            depositAmount: config.depositAmount,
            depositPercent: config.depositPercent,
            giftCardAmounts: config.giftCardAmounts,
            giftCardExpiryDays: config.giftCardExpiryDays,
            referralCredit: config.referralCredit,
            noShowFee: config.noShowFee,
            reengagementDays: config.reengagementDays,
            membershipPlans: config.membershipPlans,
            stripePublishable: config.stripePublishable,
            bankIban: config.bankIban,
            bankBeneficiary: config.bankBeneficiary,
            preciosServicios: config.preciosServicios
          }
        });
      }

      if (ruta === '/api/servicios' && req.method === 'GET') {
        return json(res, 200, { ok: true, servicios: SERVICIOS });
      }

      if (ruta === '/api/horarios' && req.method === 'GET') {
        return json(res, 200, { ok: true, horarios: HORARIOS });
      }

      if (ruta === '/api/disponibilidad' && req.method === 'GET') {
        return await apiDisponibilidad(url, res);
      }

      if (ruta === '/api/citas' && req.method === 'POST') {
        return await apiCrearCita(req, res);
      }

      if (ruta === '/api/admin/citas' && req.method === 'GET') {
        return await apiAdminCitas(url, res);
      }

      if (ruta === '/api/admin/diagnostico' && req.method === 'GET') {
        return await apiAdminDiagnostico(url, res);
      }

      if (ruta === '/api/admin/citas.ics' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const ics = icsGenerar(await store.recientes());
        res.writeHead(200, {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="citas-mayka.ics"'
        });
        return res.end(ics);
      }

      const mCambio = ruta.match(/^\/api\/admin\/citas\/([A-Za-z0-9-]+)$/);
      if (mCambio && (req.method === 'PATCH' || req.method === 'POST')) {
        return await apiAdminCambio(req, res, mCambio[1]);
      }

      /* ---------- Revenue: público ---------- */
      if (ruta === '/api/productos' && req.method === 'GET') {
        await revenue.seedProductos();
        return json(res, 200, { ok: true, productos: await storage.all('products') });
      }

      if (ruta === '/api/bonos/validar' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        const r = await revenue.validarBono(d.code);
        return json(res, r.ok ? 200 : 404, r.ok ? { ok: true, bono: { code: r.bono.code, balance: r.bono.balance, expiresAt: r.bono.expiresAt } } : { ok: false, error: r.error });
      }

      if (ruta === '/api/bonos/comprar' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        try {
          const bono = await revenue.crearBono(d);
          return json(res, 201, { ok: true, bono: { id: bono.id, code: bono.code, amount: bono.amount, balance: bono.balance, expiresAt: bono.expiresAt, status: bono.status } });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      if (ruta === '/api/membresias/planes' && req.method === 'GET') {
        return json(res, 200, { ok: true, planes: config.membershipPlans });
      }

      if (ruta === '/api/membresias/suscribirse' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        try {
          const socio = await revenue.suscribirse(d);
          return json(res, 201, { ok: true, membresia: socio });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      if (ruta === '/api/pedidos' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        try {
          const pedido = await revenue.crearPedido(d);
          return json(res, 201, { ok: true, pedido });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      if (ruta === '/api/lista-espera' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        try {
          const e = await revenue.apuntarseEspera(d);
          return json(res, 201, { ok: true, espera: e });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      if (ruta === '/api/referidos/codigo' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        const ref = await revenue.obtenerReferido(d.email, d.nombre);
        return json(res, 200, { ok: true, referido: { code: ref.code, credits: ref.credits, totalEarned: ref.totalEarned } });
      }

      if (ruta === '/api/referidos/aplicar' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        const r = await revenue.aplicarReferido(d.code, d.email);
        return json(res, r.ok ? 200 : 422, r.ok ? { ok: true, credito: r.credito, padrino: r.referrer } : { ok: false, error: r.error });
      }

      /* ---------- Revenue: admin ---------- */
      if (ruta === '/api/admin/ingresos' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const citas = await store.all();
        const data = await revenue.analitica(citas);
        return json(res, 200, { ok: true, data });
      }

      if (ruta === '/api/admin/clientes' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const citas = await store.all();
        const clientes = await revenue.clientesUnicos(citas);
        return json(res, 200, { ok: true, clientes });
      }

      if (ruta === '/api/admin/bonos' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        return json(res, 200, { ok: true, bonos: await storage.all('giftcards') });
      }

      if (ruta === '/api/admin/bonos' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        try {
          const bono = await revenue.crearBono(d);
          if (d.activar) await revenue.activarBono(bono.id);
          return json(res, 201, { ok: true, bono });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      const mBono = ruta.match(/^\/api\/admin\/bonos\/([A-Za-z0-9-]+)$/);
      if (mBono && (req.method === 'PATCH' || req.method === 'POST')) {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const b = await storage.update('giftcards', mBono[1], d);
        if (!b) return json(res, 404, { ok: false, error: 'Bono no encontrado.' });
        return json(res, 200, { ok: true, bono: b });
      }

      if (ruta === '/api/admin/membresias' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        return json(res, 200, { ok: true, membresias: await storage.all('memberships') });
      }

      const mSocio = ruta.match(/^\/api\/admin\/membresias\/([A-Za-z0-9-]+)$/);
      if (mSocio && (req.method === 'PATCH' || req.method === 'POST')) {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const s = await storage.update('memberships', mSocio[1], d);
        if (!s) return json(res, 404, { ok: false, error: 'Socio no encontrado.' });
        return json(res, 200, { ok: true, membresia: s });
      }

      if (ruta === '/api/admin/lista-espera' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        return json(res, 200, { ok: true, espera: await storage.all('waitlist') });
      }

      const mEspera = ruta.match(/^\/api\/admin\/lista-espera\/([A-Za-z0-9-]+)$/);
      if (mEspera && (req.method === 'PATCH' || req.method === 'POST')) {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const w = await storage.update('waitlist', mEspera[1], d);
        if (!w) return json(res, 404, { ok: false, error: 'Entrada no encontrada.' });
        return json(res, 200, { ok: true, espera: w });
      }

      if (ruta === '/api/admin/pedidos' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        return json(res, 200, { ok: true, pedidos: await storage.all('orders') });
      }

      const mPedido = ruta.match(/^\/api\/admin\/pedidos\/([A-Za-z0-9-]+)$/);
      if (mPedido && (req.method === 'PATCH' || req.method === 'POST')) {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const p = await storage.update('orders', mPedido[1], d);
        if (!p) return json(res, 404, { ok: false, error: 'Pedido no encontrado.' });
        return json(res, 200, { ok: true, pedido: p });
      }

      if (ruta === '/api/admin/productos' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        await revenue.seedProductos();
        return json(res, 200, { ok: true, productos: await storage.all('products') });
      }

      if (ruta === '/api/admin/productos' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        try {
          const p = await storage.add('products', {
            nombre: d.nombre, descripcion: d.descripcion, precio: Number(d.precio || 0),
            stock: Number(d.stock || 0), categoria: d.categoria || 'general', activo: d.activo !== false
          }, 'PROD');
          return json(res, 201, { ok: true, producto: p });
        } catch (err) {
          return json(res, 422, { ok: false, error: err.message });
        }
      }

      const mProd = ruta.match(/^\/api\/admin\/productos\/([A-Za-z0-9-]+)$/);
      if (mProd && (req.method === 'PATCH' || req.method === 'POST')) {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const p = await storage.update('products', mProd[1], d);
        if (!p) return json(res, 404, { ok: false, error: 'Producto no encontrado.' });
        return json(res, 200, { ok: true, producto: p });
      }

      if (ruta === '/api/admin/referidos' && req.method === 'GET') {
        if (!adminAutorizado(url)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        return json(res, 200, { ok: true, referidos: await storage.all('referrals') });
      }

      if (ruta === '/api/admin/reengagement' && req.method === 'POST') {
        const d = await leerCuerpo(req);
        if (!tokenValido(d.token)) return json(res, 401, { ok: false, error: 'Token no válido.' });
        const citas = await store.all();
        const dormidos = revenue.clientesDormidos(citas);
        const enviados = [];
        for (const cl of dormidos) {
          if (!cl.email) continue;
          try {
            await mailer.enviarPorFormSubmit ? null : null;
          } catch (e) { /* ignore */ }
          enviados.push(cl.email);
        }
        return json(res, 200, { ok: true, candidatos: dormidos.length, enviados: enviados.length, clientes: dormidos });
      }

      /* Exponer config de revenue en /api/config */
      /* (se añade más abajo en apiConfig) */

      return json(res, 404, { ok: false, error: 'Endpoint no encontrado.' });
    }

    /* -------- Archivos estáticos -------- */
    if (ruta === '/' || ruta === '/index.html') {
      return servirArchivo(res, path.join(config.publicDir, 'index.html'), req);
    }
    if (ruta === '/admin' || ruta === '/admin/') {
      return servirArchivo(res, path.join(config.publicDir, 'admin.html'), req);
    }
    return servirDesde(res, config.publicDir, ruta, req);
  } catch (err) {
    console.error('[error]', err);
    return json(res, 500, { ok: false, error: 'Error interno del servidor.' });
  }
}

module.exports = { handle, normalizarToken, tokenValido, validarCita };
