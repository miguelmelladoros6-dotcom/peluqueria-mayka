'use strict';
/* =============================================================
   Envío de correo de citas.

   Dos transporters disponibles:
     1. SMTP (nodemailer) — recomendado. Gmail con "contraseña de app".
     2. FormSubmit.co — alternativa sin configuración, requiere
        activar el destinatario una vez desde el correo.

   Si no hay SMTP configurado, se usa FormSubmit automáticamente.
   ============================================================= */
const config = require('./config');
const schedule = require('./schedule');

let nodemailer = null;
try {
  /* eslint-disable-next-line global-require */
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function fechaLegible(fecha) {
  if (!schedule.isValidDate(fecha)) return fecha;
  const d = new Date(fecha + 'T00:00:00Z');
  const dia = DIAS[d.getUTCDay()];
  const num = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  return `${dia}, ${num} de ${mes} de ${d.getUTCFullYear()}`;
}

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plantillaEmail(cita, servicio) {
  const fechaTxt = fechaLegible(cita.fecha);
  const notas = cita.notas
    ? `<tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;width:150px;vertical-align:top;">Notas</td>
         <td style="padding:10px 0;border-top:1px solid #eadfd3;color:#241c1a;font-size:15px;">${escapar(cita.notas)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6efe7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#241c1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(36,28,26,.08);">
        <tr><td style="background:#241c1a;padding:26px 32px;">
          <p style="margin:0;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#c9a27e;">Nueva cita</p>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:600;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">Peluquería Mayka</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#c6b6a8;">Avenida Europa nº 5 · 30710 Los Alcázares (Murcia)</p>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#241c1a;">
            Se ha reservado una cita. Detalles:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;width:150px;">Cliente</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;font-weight:600;">${escapar(cita.nombre)}</td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Teléfono</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;"><a href="tel:${escapar(cita.telefono)}" style="color:#a8624f;text-decoration:none;font-weight:600;">${escapar(cita.telefono)}</a></td></tr>
            ${cita.email ? `<tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Correo</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;"><a href="mailto:${escapar(cita.email)}" style="color:#a8624f;text-decoration:none;">${escapar(cita.email)}</a></td></tr>` : ''}
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Servicio</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;font-weight:600;">${escapar(servicio ? servicio.nombre : cita.servicio)}</td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Fecha</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;font-weight:600;text-transform:capitalize;">${escapar(fechaTxt)}</td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Hora</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;font-weight:600;font-size:18px;">${escapar(cita.hora)}</td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Duración</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;">${escapar(cita.duracion)} min</td></tr>
            ${notas}
            <tr><td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Referencia</td>
                <td style="padding:10px 0;border-top:1px solid #eadfd3;color:#7a6a5f;">${escapar(cita.id)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 32px 30px;">
          <p style="margin:0;font-size:13px;color:#7a6a5f;line-height:1.6;">
            Puedes confirmar o cancelar esta cita desde el panel de gestión
            (<a href="${escapar(config.shopUrl || '')}/admin" style="color:#a8624f;">panel de citas</a>)
            o responder a este correo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function plantillaConfirmacion(cita, servicio) {
  const fechaTxt = fechaLegible(cita.fecha);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6efe7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#241c1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(36,28,26,.08);">
        <tr><td style="background:#241c1a;padding:26px 32px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:600;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">Peluquería Mayka</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#c6b6a8;">Los Alcázares · Murcia</p>
        </td></tr>
        <tr><td style="padding:30px 32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#c9a27e;">Cita solicitada</p>
          <h2 style="margin:0 0 18px;font-size:22px;font-weight:600;font-family:Georgia,'Times New Roman',serif;">¡Hola, ${escapar(cita.nombre)}!</h2>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4a3d38;">
            Hemos recibido tu solicitud de cita. Te confirmaremos por teléfono o correo
            si hubiera cualquier cambio.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f2;border-radius:14px;font-size:15px;">
            <tr><td style="padding:14px 20px;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Servicio</td>
                <td style="padding:14px 20px;font-weight:600;text-align:right;">${escapar(servicio ? servicio.nombre : cita.servicio)}</td></tr>
            <tr><td style="padding:14px 20px;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Día</td>
                <td style="padding:14px 20px;border-top:1px solid #eadfd3;font-weight:600;text-align:right;text-transform:capitalize;">${escapar(fechaTxt)}</td></tr>
            <tr><td style="padding:14px 20px;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Hora</td>
                <td style="padding:14px 20px;border-top:1px solid #eadfd3;font-weight:600;text-align:right;font-size:18px;">${escapar(cita.hora)}</td></tr>
            <tr><td style="padding:14px 20px;border-top:1px solid #eadfd3;color:#7a6a5f;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Referencia</td>
                <td style="padding:14px 20px;border-top:1px solid #eadfd3;color:#7a6a5f;text-align:right;">${escapar(cita.id)}</td></tr>
          </table>
          <p style="margin:22px 0 0;font-size:14px;color:#7a6a5f;line-height:1.7;">
            Av. Europa nº 5, Los Narejos · 30710 Los Alcázares (Murcia)<br>
            Teléfono: <a href="tel:+34868700105" style="color:#a8624f;">+34 868 70 01 05</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textoPlano(cita, servicio) {
  return [
    `PELUQUERÍA MAYKA — Los Alcázares (Murcia)`,
    ``,
    `Nueva cita`,
    ``,
    `Cliente:   ${cita.nombre}`,
    `Teléfono:  ${cita.telefono}`,
    cita.email ? `Correo:    ${cita.email}` : null,
    `Servicio:  ${servicio ? servicio.nombre : cita.servicio}`,
    `Fecha:     ${fechaLegible(cita.fecha)}`,
    `Hora:      ${cita.hora}`,
    `Duración:  ${cita.duracion} min`,
    cita.notas ? `Notas:     ${cita.notas}` : null,
    `Referencia:${cita.id}`,
    ``,
    `Av. Europa nº 5, 30710 Los Alcázares (Murcia) · +34 868 70 01 05`
  ].filter((l) => l !== null).join('\n');
}

/* Dominios a los que se permite enviar la copia de confirmación al cliente.
   Evita que la web se use como remitente masivo de correos. */
const DOMINIOS_POR_DEFECTO = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com',
  'outlook.es', 'live.com', 'live.es', 'msn.com', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me',
  'gmx.com', 'gmx.es', 'mail.com', 'zoho.com', 'terra.com', 'tuenti.com',
  'madrileña.com', 'madrid.es', 'telefonica.com', 'orange.es', 'movistar.es',
  'ymail.com', 'fastmail.com', 'tutanota.com', 'loca.lt'
];

function dominiosPermitidos() {
  const extra = String(process.env.MAIL_ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return DOMINIOS_POR_DEFECTO.concat(extra);
}

/** ¿Se puede enviar la copia al cliente? */
function copiaPermitida(email) {
  if (!email) return false;
  const dominio = String(email).split('@')[1];
  if (!dominio) return false;
  return dominiosPermitidos().includes(dominio.toLowerCase());
}

/* ---------- campos planos para FormSubmit ---------- */

/*
  FormSubmit renderiza los campos enviados como una tabla.
  Hay que enviar campos planos y legibles (Cliente, Servicio, Fecha…),
  nunca el HTML: si se manda el HTML, el correo muestra el código fuente.
*/
function camposPropietario(cita, servicio) {
  const campos = {
    'Cliente': cita.nombre,
    'Teléfono': cita.telefono,
    'Correo': cita.email || '—',
    'Servicio': servicio ? servicio.nombre : cita.servicio,
    'Día': fechaLegible(cita.fecha),
    'Hora': cita.hora,
    'Duración': (cita.duracion || '') + ' min',
    'Referencia': cita.id
  };
  if (cita.notas) campos['Notas'] = cita.notas;
  return campos;
}

function camposCliente(cita, servicio) {
  return {
    'Cliente': cita.nombre,
    'Servicio': servicio ? servicio.nombre : cita.servicio,
    'Día': fechaLegible(cita.fecha),
    'Hora': cita.hora,
    'Duración': (cita.duracion || '') + ' min',
    'Referencia': cita.id,
    'Teléfono del salón': '+34 868 70 01 05',
    'Dirección': 'Avenida Europa nº 5, 30710 Los Alcázares (Murcia)'
  };
}

/* ---------- transports ---------- */

function smtpDisponible() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && nodemailer);
}

async function enviarPorSmtp(mensaje) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
  await transporter.sendMail(mensaje);
}

async function enviarPorFormSubmit(destinatario, asunto, campos) {
  const cuerpo = new URLSearchParams();
  cuerpo.set('_subject', asunto);
  cuerpo.set('_template', 'table');
  cuerpo.set('_captcha', 'false');
  Object.keys(campos || {}).forEach(function (clave) {
    cuerpo.set(clave, String(campos[clave] == null ? '' : campos[clave]));
  });

  const url = `https://formsubmit.co/ajax/${encodeURIComponent(destinatario)}`;

  /* FormSubmit exige que la peticion venga desde un servidor web:
     sin cabeceras Referer/Origin responde "will not work in pages browsed as HTML files". */
  const cabeceras = {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    Accept: 'application/json'
  };
  const origen = config.siteUrl || `http://localhost:${config.port}`;
  if (!config.siteUrl) {
    console.warn(
      '[mailer] PUBLIC_URL no está definido: se usará "' + origen +
      '" como Referer. Si estás en Netlify, define PUBLIC_URL con la URL del sitio.'
    );
  }
  cabeceras.Referer = origen + '/';
  cabeceras.Origin = origen;

  const res = await fetch(url, {
    method: 'POST',
    headers: cabeceras,
    body: cuerpo.toString()
  });
  const textoRespuesta = await res.text();
  if (!res.ok) throw new Error(`FormSubmit respondió ${res.status}: ${textoRespuesta}`);
  let json = null;
  try {
    json = JSON.parse(textoRespuesta);
  } catch (err) {
    return textoRespuesta;
  }
  if (json && json.success === 'false') {
    throw new Error(json.message || 'FormSubmit rechazó el envío');
  }
  return textoRespuesta;
}

/* ---------- API pública ---------- */

/**
 * Envía la cita al correo del negocio (y copia al cliente).
 * @returns {Promise<{enviado:boolean, transporte:string, error:string|null}>}
 */
async function enviarCita(cita, servicio) {
  const asunto = `Nueva cita · ${servicio ? servicio.nombre : cita.servicio} · ${cita.nombre} · ${cita.fecha} ${cita.hora}`;
  const html = plantillaEmail(cita, servicio);
  const texto = textoPlano(cita, servicio);

  const destinatarios = [{ email: config.shopEmail, nombre: 'Peluquería Mayka' }];
  const copiaCliente = config.mailClientCopy && cita.email && copiaPermitida(cita.email);
  if (copiaCliente) {
    destinatarios.push({ email: cita.email, nombre: cita.nombre });
  }

  const modo = config.mailMode;

  if (modo === 'off') {
    return { enviado: false, transporte: 'off', error: null };
  }

  if (modo === 'smtp' || (modo === 'auto' && smtpDisponible())) {
    try {
      for (const dest of destinatarios) {
        await enviarPorSmtp({
          from: config.mailFrom || config.smtp.user,
          to: dest.email,
          subject: asunto,
          html,
          text: texto,
          replyTo: cita.email || undefined
        });
      }
      return { enviado: true, transporte: 'smtp', error: null };
    } catch (err) {
      if (modo === 'smtp') {
        return { enviado: false, transporte: 'smtp', error: err.message };
      }
      /* auto: cae a FormSubmit */
    }
  }

  if (modo === 'formsubmit' || modo === 'auto') {
    try {
      for (const dest of destinatarios) {
        const campos = dest.email === config.shopEmail
          ? camposPropietario(cita, servicio)
          : camposCliente(cita, servicio);
        const asuntoDest = dest.email === config.shopEmail
          ? asunto
          : 'Cita reservada en Peluquería Mayka · ' + cita.fecha + ' ' + cita.hora;
        await enviarPorFormSubmit(dest.email, asuntoDest, campos);
      }
      return { enviado: true, transporte: 'formsubmit', error: null };
    } catch (err) {
      return { enviado: false, transporte: 'formsubmit', error: err.message };
    }
  }

  return { enviado: false, transporte: 'ninguno', error: 'No hay transport de correo configurado.' };
}

/** Aviso al negocio cuando se cambia el estado de una cita. */
async function enviarCambioEstado(cita, servicio, estadoAnterior) {
  const asunto = `Cita ${estadoAnterior ? 'actualizada' : 'actualizada'} · ${cita.id} · ${cita.fecha} ${cita.hora}`;
  const html = plantillaEmail(cita, servicio);
  const texto = textoPlano(cita, servicio);
  try {
    if (config.mailMode === 'off') return { enviado: false, transporte: 'off', error: null };
    if (config.mailMode === 'smtp' || (config.mailMode === 'auto' && smtpDisponible())) {
      await enviarPorSmtp({
        from: config.mailFrom || config.smtp.user,
        to: config.shopEmail,
        subject: asunto,
        html,
        text: texto
      });
      return { enviado: true, transporte: 'smtp', error: null };
    }
    await enviarPorFormSubmit(config.shopEmail, asunto, camposPropietario(cita, servicio));
    return { enviado: true, transporte: 'formsubmit', error: null };
  } catch (err) {
    return { enviado: false, transporte: 'error', error: err.message };
  }
}

module.exports = {
  enviarCita,
  enviarCambioEstado,
  fechaLegible,
  smtpDisponible,
  copiaPermitida,
  camposPropietario,
  camposCliente,
  plantillaEmail,
  textoPlano
};
