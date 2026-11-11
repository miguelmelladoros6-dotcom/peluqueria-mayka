#!/usr/bin/env node
/* =============================================================
   Genera el ZIP listo para Netlify Drop (arrastrar y soltar).

   El ZIP contiene el contenido de public/ en la raíz:
   index.html, admin.html, css/, js/, shared/, favicon.svg,
   _redirects y _headers.

   Uso:  node scripts/crear-zip.js
   ============================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const PUBLICO = path.join(RAIZ, 'public');
const DESTINO = path.join(RAIZ, 'peluqueria-mayka-web.zip');

/* Lista de lo que se empaqueta (nada de .env ni datos de citas) */
const INCLUIDOS = [
  'index.html',
  'admin.html',
  'favicon.svg',
  '_redirects',
  '_headers',
  'css',
  'js',
  'shared'
];

function listar(base, relative) {
  const dir = path.join(base, relative);
  const salida = [];
  if (!fs.existsSync(dir)) return salida;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name.startsWith('.')) continue;
    const rel = relative ? path.join(relative, entrada.name) : entrada.name;
    if (entrada.isDirectory()) {
      salida.push(...listar(base, rel));
    } else {
      salida.push(rel);
    }
  }
  return salida;
}

const ficheros = [];
for (const item of INCLUIDOS) {
  const ruta = path.join(PUBLICO, item);
  if (!fs.existsSync(ruta)) {
    console.warn('  (aviso) no existe:', item);
    continue;
  }
  if (fs.statSync(ruta).isDirectory()) {
    ficheros.push(...listar(PUBLICO, item));
  } else {
    ficheros.push(item);
  }
}

if (!ficheros.includes('index.html')) {
  console.error('ERROR: falta index.html en la raíz del sitio.');
  process.exit(1);
}

/* Comprobación: el HTML principal debe referenciar los ficheros compartidos */
const html = fs.readFileSync(path.join(PUBLICO, 'index.html'), 'utf8');
for (const necesario of ['/shared/servicios.js', '/shared/horarios.js']) {
  if (html.indexOf(necesario) === -1) {
    console.error('ERROR: index.html no referencia', necesario);
    process.exit(1);
  }
}

if (fs.existsSync(DESTINO)) fs.unlinkSync(DESTINO);

/* Comprimir con el Compress-Archive de PowerShell (incluye carpetas) */
const temporales = path.join(RAIZ, '.zip-temp');
if (fs.existsSync(temporales)) fs.rmSync(temporales, { recursive: true, force: true });
fs.mkdirSync(temporales, { recursive: true });

for (const rel of ficheros) {
  const origen = path.join(PUBLICO, rel);
  const destino = path.join(temporales, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
}

const zipTemporal = path.join(RAIZ, '.zip-temp.zip');
execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${temporales}\\*" -DestinationPath "${zipTemporal}" -Force`
  ],
  { stdio: 'inherit' }
);

fs.renameSync(zipTemporal, DESTINO);
fs.rmSync(temporales, { recursive: true, force: true });

const tam = (fs.statSync(DESTINO).size / 1024).toFixed(1);
console.log('');
console.log('  ZIP creado: ' + DESTINO);
console.log('  Tamaño: ' + tam + ' KB');
console.log('  Contenido (' + ficheros.length + ' ficheros):');
for (const f of ficheros) console.log('    ' + f);
console.log('');
console.log('  Súbelo arrastrándolo a https://app.netlify.com/drop');
console.log('');
