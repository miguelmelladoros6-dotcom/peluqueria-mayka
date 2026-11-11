'use strict';
/* =============================================================
   Almacenamiento genérico de colecciones (bonos, socios, pedidos…).

   Mismo backend que store.js: Netlify Blobs si estamos en Netlify,
   archivo JSON en data/<coleccion>.json en servidor propio.

   Cada colección se guarda como un array de objetos con `id`.
   ============================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

let modo = null;          /* 'blobs' | 'archivo' */
let blobsDisponible = false;
let blobsModulo = null;

function detectar() {
  if (modo) return modo;
  if (process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_SITE_ID) {
    try {
      /* eslint-disable-next-line global-require */
      blobsModulo = require('@netlify/blobs');
      blobsDisponible = true;
      modo = 'blobs';
      console.log('[storage] Usando Netlify Blobs.');
      return modo;
    } catch (err) {
      console.warn('[storage] Blobs no disponible, se usará archivo:', err.message);
    }
  }
  modo = 'archivo';
  return modo;
}

function modoActual() { detectar(); return modo; }

const caches = {};
const blobStores = {};

function storeBlobs(nombre) {
  if (blobStores[nombre]) return blobStores[nombre];
  const opciones = {};
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN) {
    opciones.siteID = process.env.NETLIFY_SITE_ID;
    opciones.token = process.env.NETLIFY_AUTH_TOKEN;
  }
  const store = blobsModulo.getStore(nombre, opciones);
  blobStores[nombre] = store;
  return store;
}

function archivoRuta(nombre) {
  return path.join(path.dirname(config.dataFile), nombre + '.json');
}

function ensureFile(nombre) {
  const ruta = archivoRuta(nombre);
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, '[]', 'utf8');
  }
}

function sinBOM(texto) { return String(texto).replace(/^\uFEFF/, ''); }

async function leerBruto(nombre) {
  detectar();
  if (modo === 'blobs') {
    try {
      const store = storeBlobs(nombre);
      const valor = await store.get(nombre, { type: 'json' });
      return Array.isArray(valor) ? valor : [];
    } catch (err) {
      if (err && (err.name === 'NotFoundError' || err.status === 404)) return [];
      throw err;
    }
  }
  ensureFile(nombre);
  try {
    const raw = sinBOM(fs.readFileSync(archivoRuta(nombre), 'utf8'));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[storage] No se pudo leer ' + nombre + ':', err.message);
    return [];
  }
}

async function escribirBruto(nombre, datos) {
  detectar();
  if (modo === 'blobs') {
    const store = storeBlobs(nombre);
    await store.set(nombre, datos);
    return;
  }
  ensureFile(nombre);
  fs.writeFileSync(archivoRuta(nombre), JSON.stringify(datos, null, 2), 'utf8');
}

async function cargar(nombre) {
  if (!caches[nombre]) caches[nombre] = await leerBruto(nombre);
  return caches[nombre];
}

function invalidar(nombre) {
  delete caches[nombre];
}

async function all(nombre) {
  const datos = await cargar(nombre);
  return datos.slice();
}

async function find(nombre, id) {
  const datos = await cargar(nombre);
  return datos.find((x) => x.id === id) || null;
}

async function add(nombre, item, prefijo) {
  const datos = await cargar(nombre);
  const pref = prefijo || (nombre.slice(0, 3).toUpperCase());
  const nuevo = Object.assign(
    { id: pref + '-' + crypto.randomBytes(4).toString('hex').toUpperCase(), creado: new Date().toISOString() },
    item
  );
  datos.push(nuevo);
  await escribirBruto(nombre, datos);
  return nuevo;
}

async function update(nombre, id, cambios) {
  const datos = await cargar(nombre);
  const idx = datos.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  datos[idx] = Object.assign({}, datos[idx], cambios, { actualizado: new Date().toISOString() });
  await escribirBruto(nombre, datos);
  return datos[idx];
}

async function remove(nombre, id) {
  const datos = await cargar(nombre);
  const idx = datos.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  datos.splice(idx, 1);
  await escribirBruto(nombre, datos);
  return true;
}

async function query(nombre, predicado) {
  const datos = await cargar(nombre);
  return datos.filter(predicado);
}

async function reemplazar(nombre, datos) {
  caches[nombre] = datos.slice();
  await escribirBruto(nombre, datos);
}

module.exports = {
  detectar,
  modo: modoActual,
  all,
  find,
  add,
  update,
  remove,
  query,
  reemplazar,
  invalidar,
  reiniciar: (nombre) => {
    if (nombre) delete caches[nombre];
    else Object.keys(caches).forEach((k) => delete caches[k]);
  }
};
