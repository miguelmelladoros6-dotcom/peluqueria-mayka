'use strict';
/* =============================================================
   Motor de horarios y disponibilidad.
   Usa el horario real del negocio (public/shared/horarios.js) y las
   citas ya guardadas para calcular las horas libres.
   ============================================================= */
const HORARIOS = require('../public/shared/horarios');

const MINUTOS_POR_DIA = 1440;

/* ---------- utilidades de fecha/hora ---------- */

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function isValidDate(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return false;
  const d = new Date(fecha + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

/** Día de la semana (0 = domingo ... 6 = sábado) de una fecha YYYY-MM-DD. */
function weekdayOf(fecha) {
  return new Date(fecha + 'T00:00:00Z').getUTCDay();
}

/** Fecha de hoy en la zona horaria del negocio (YYYY-MM-DD). */
function today(tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/** Minutos transcurridos del día en la zona horaria del negocio. */
function nowMinutes(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const h = Number((parts.find((p) => p.type === 'hour') || {}).value || 0);
  const m = Number((parts.find((p) => p.type === 'minute') || {}).value || 0);
  return h * 60 + m;
}

function addDays(fecha, dias) {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function daysBetween(desde, hasta) {
  const a = new Date(desde + 'T00:00:00Z').getTime();
  const b = new Date(hasta + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

/* ---------- horarios ---------- */

/** Franjas de trabajo de una fecha, en minutos. Vacío si está cerrado. */
function franjasDe(fecha) {
  if (!isValidDate(fecha)) return [];
  const dia = weekdayOf(fecha);
  const franjas = HORARIOS[dia] || [];
  return franjas.map(([ini, fin]) => [timeToMinutes(ini), timeToMinutes(fin)]);
}

function estaAbierto(fecha) {
  return franjasDe(fecha).length > 0;
}

/* ---------- disponibilidad ---------- */

/**
 * Calcula las horas ofrecidas para una fecha y duración.
 * @param {string} fecha      YYYY-MM-DD
 * @param {number} duracion   minutos de duración del servicio
 * @param {Array}  citas      citas bloqueantes
 * @param {Object} opciones   { capacity, slotStep, tz, minLeadMinutes }
 */
function calcularSlots(fecha, duracion, citas, opciones) {
  const opts = Object.assign(
    { capacity: 1, slotStep: 30, tz: 'Europe/Madrid', minLeadMinutes: 60 },
    opciones || {}
  );
  const franjas = franjasDe(fecha);
  const resultado = [];

  if (!franjas.length) return resultado;

  const esHoy = fecha === today(opts.tz);
  const ahora = nowMinutes(opts.tz);
  const dur = Number(duracion) || 30;

  const delDia = (citas || []).filter((c) => c.fecha === fecha);

  franjas.forEach(([ini, fin]) => {
    for (let inicio = ini; inicio + dur <= fin; inicio += opts.slotStep) {
      const finCita = inicio + dur;

      const solapadas = delDia.filter((c) => {
        const cIni = timeToMinutes(c.hora);
        const cFin = cIni + (Number(c.duracion) || 30);
        return inicio < cFin && cIni < finCita;
      });

      let disponible = true;
      let motivo = '';

      if (solapadas.length >= opts.capacity) {
        disponible = false;
        motivo = 'ocupado';
      } else if (esHoy && inicio < ahora + opts.minLeadMinutes) {
        disponible = false;
        motivo = 'pasado';
      }

      resultado.push({
        hora: minutesToTime(inicio),
        fin: minutesToTime(finCita),
        duracion: dur,
        disponible: disponible,
        motivo: motivo
      });
    }
  });

  return resultado;
}

/** ¿Existe ya una cita con ese hueco? (comprobación en el momento de reservar) */
function slotReservado(fecha, hora, duracion, citas, capacidad) {
  const dur = Number(duracion) || 30;
  const inicio = timeToMinutes(hora);
  const finCita = inicio + dur;
  const solapadas = (citas || [])
    .filter((c) => c.fecha === fecha)
    .filter((c) => {
      const cIni = timeToMinutes(c.hora);
      const cFin = cIni + (Number(c.duracion) || 30);
      return inicio < cFin && cIni < finCita;
    });
  return solapadas.length >= (capacidad || 1);
}

module.exports = {
  HORARIOS,
  timeToMinutes,
  minutesToTime,
  isValidDate,
  weekdayOf,
  today,
  nowMinutes,
  addDays,
  daysBetween,
  franjasDe,
  estaAbierto,
  calcularSlots,
  slotReservado,
  MINUTOS_POR_DIA
};
