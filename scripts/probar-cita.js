#!/usr/bin/env node
/* =============================================================
   Envía una cita de prueba para comprobar el correo.

   Uso:  node scripts/probar-cita.js [http://localhost:3000]
   ============================================================= */
'use strict';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';

const cita = {
  nombre: 'Prueba de correo',
  telefono: '600 00 00 00',
  email: 'prueba@gmail.com',
  servicio: 'corte-mujer',
  fecha: '2026-11-28',
  hora: '10:00',
  notas: 'Prueba automática del sistema de citas',
  privacidad: true,
  origen: 'prueba'
};

(async () => {
  console.log('');
  console.log('Enviando cita de prueba a ' + BASE + ' ...');
  console.log('');

  try {
    const res = await fetch(BASE + '/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cita)
    });
    const json = await res.json();

    if (!json.ok) {
      console.log('  ERROR: ' + (json.error || 'desconocido'));
      if (json.errores) {
        Object.keys(json.errores).forEach((k) => console.log('    - ' + k + ': ' + json.errores[k]));
      }
      process.exit(1);
    }

    console.log('  Cita creada : ' + json.cita.id);
    console.log('  Servicio    : ' + json.cita.servicio);
    console.log('  Fecha       : ' + json.cita.fechaLegible + ' a las ' + json.cita.hora);
    console.log('  Correo      : ' + (json.correoEnviado ? 'ENVIADO (' + json.correoTransporte + ')' : 'NO ENVIADO'));
    console.log('');

    if (json.correoEnviado) {
      console.log('  Revisa la bandeja de miguelmelladoros6@gmail.com');
      console.log('  (tambien la carpeta de spam / promociones)');
    } else {
      console.log('  El envio no se pudo completar. Motivo:');
      console.log('    ' + (json.correoError || 'sin detalle'));
      console.log('');
      if (/Activation/i.test(json.correoError || '')) {
        console.log('  ESTO ES NORMAL LA PRIMERA VEZ.');
        console.log('  FormSubmit te ha enviado un email a miguelmelladoros6@gmail.com');
        console.log('  con un enlace "Activate Form". Abrilo y haz clic UNA VEZ.');
        console.log('  Despues vuelve a ejecutar este script y el correo llegara.');
        console.log('');
        console.log('  Si no lo encuentras, mira en la carpeta de spam o promociones.');
      }
    }
    console.log('');
  } catch (err) {
    console.log('  No se pudo contactar con el servidor: ' + err.message);
    console.log('  Comprueba que este en marcha:  node server/index.js');
    console.log('');
  }
})();
