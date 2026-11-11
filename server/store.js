'use strict';
/* =============================================================
   Almacén de citas.

   Dos backends, chosen automáticamente:
     · Netlify Blobs  → cuando se ejecuta dentro de Netlify
                        Functions (las citas persisten entre reinicios)
     · Archivo JSON   → en un servidor propio (data/citas.json)

   Cada cita guardada bloquea su franja horaria para el resto de
   peluqueras según la capacidad configurada.
   ============================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const CLAVE = 'citas';
let cache = null;
let modo = null; /* 'blobs' | 'archivo' */
let blobsStore = null;

/* ---------- detección del backend ---------- */

function usarBlobs() {
  if (modo) return modo === 'blobs';
  /* Netlify inyecta NETLIFY_BLOBS_CONTEXT en sus funciones */
  if (process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_SITE_ID) {
    try {
      /* eslint-disable-next-line global-require */
      const blobs = require('@netlify/blobs');
      const opciones = {};
      if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN) {
        opciones.siteID = process.env.NETLIFY_SITE_ID;
        opciones.token = process.env.NETLIFY_AUTH_TOKEN;
      }
      blobsStore = blobs.getStore(CLAVE, opciones);
      modo = 'blobs';
      console.log('[store] Usando Netlify Blobs para las citas.');
      return true;
    } catch (err) {
      console.warn('[store] Netlify Blobs no disponible, se usará el archivo local:', err.message);
    }
  }
  modo = 'archivo';
  return false;
}

function modoActual() {
  usarBlobs();
  return modo;
}

/* ---------- lectura / escritura ---------- */

function sinBOM(texto) {
  return String(texto).replace(/^\uFEFF/, '');
}

function archivoRuta() {
  return config.dataFile;
}

function ensureFile() {
  const ruta = archivoRuta();
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, '[]', 'utf8');
  }
}

async function leerBruto() {
  if (usarBlobs()) {
    try {
      const valor = await blobsStore.get(CLAVE, { type: 'json' });
      return Array.isArray(valor) ? valor : [];
    } catch (err) {
      if (err && (err.name === 'NotFoundError' || err.status === 404)) return [];
      throw err;
    }
  }
  ensureFile();
  try {
    const raw = sinBOM(fs.readFileSync(archivoRuta(), 'utf8'));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[store] No se pudo leer el archivo de citas:', err.message);
    return [];
  }
}

async function escribirBruto(citas) {
  if (usarBlobs()) {
    await blobsStore.set(CLAVE, citas);
    return;
  }
  ensureFile();
  fs.writeFileSync(archivoRuta(), JSON.stringify(citas, null, 2), 'utf8');
}

async function cargar() {
  if (!cache) cache = await leerBruto();
  return cache;
}

/* ---------- API ---------- */

/** Citas que bloquean plaza (pendientes o confirmadas). */
async function blocking() {
  const citas = await cargar();
  return citas.filter((c) => c.estado !== 'cancelada');
}

async function add(cita) {
  const citas = await cargar();
  const nueva = Object.assign(
    {
      id: 'CIT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      estado: 'pendiente',
      creada: new Date().toISOString()
    },
    cita
  );
  citas.push(nueva);
  await escribirBruto(citas);
  return nueva;
}

async function update(id, cambios) {
  const citas = await cargar();
  const idx = citas.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  citas[idx] = Object.assign({}, citas[idx], cambios, { actualizada: new Date().toISOString() });
  await escribirBruto(citas);
  return citas[idx];
}

async function find(id) {
  const citas = await cargar();
  return citas.find((c) => c.id === id) || null;
}

async function all() {
  const citas = await cargar();
  return citas
    .slice()
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

async function recientes() {
  const hoy = require('./schedule').today(config.timezone);
  const citas = await all();
  return citas.filter((c) => c.fecha >= hoy && c.estado !== 'cancelada');
}

module.exports = {
  cargar,
  blocking,
  add,
  update,
  find,
  all,
  recientes,
  modo: modoActual,
  reiniciar: () => { cache = null; }
};
