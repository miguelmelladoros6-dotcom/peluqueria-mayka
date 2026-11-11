'use strict';
/* =============================================================
   Almacén de citas (archivo JSON).
   Cada cita guardada bloquea su franja horaria para el resto
   de peluqueras según la capacidad configurada.
   ============================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

let cache = null;

function ensureFile() {
  if (!fs.existsSync(config.dataFile)) {
    fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
    fs.writeFileSync(config.dataFile, '[]', 'utf8');
  }
}

/** Quita la marca de orden de bytes (BOM) que Windows añade al guardar. */
function sinBOM(texto) {
  return String(texto).replace(/^\uFEFF/, '');
}

function readAll() {
  if (cache) return cache;
  ensureFile();
  try {
    const raw = sinBOM(fs.readFileSync(config.dataFile, 'utf8'));
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[store] No se pudo leer el archivo de citas:', err.message);
    cache = [];
  }
  return cache;
}

function writeAll(citas) {
  ensureFile();
  fs.writeFileSync(config.dataFile, JSON.stringify(citas, null, 2), 'utf8');
  cache = citas;
}

/** Citas que bloquean plaza (pendientes o confirmadas). */
function blocking() {
  return readAll().filter((c) => c.estado !== 'cancelada');
}

function add(cita) {
  const citas = readAll();
  const nueva = Object.assign(
    {
      id: 'CIT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      estado: 'pendiente',
      creada: new Date().toISOString()
    },
    cita
  );
  citas.push(nueva);
  writeAll(citas);
  return nueva;
}

function update(id, cambios) {
  const citas = readAll();
  const idx = citas.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  citas[idx] = Object.assign({}, citas[idx], cambios, { actualizada: new Date().toISOString() });
  writeAll(citas);
  return citas[idx];
}

function find(id) {
  return readAll().find((c) => c.id === id) || null;
}

function all() {
  return readAll()
    .slice()
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

function recientes() {
  const hoy = require('./schedule').today(config.timezone);
  return all().filter((c) => c.fecha >= hoy && c.estado !== 'cancelada');
}

module.exports = { readAll, writeAll, add, update, find, all, blocking, recientes };
